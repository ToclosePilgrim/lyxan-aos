import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingDocType,
  CashAccountingLinkRole,
  CashTransferStatus,
  FinancialAccountType,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  StatementLineStatus,
  Prisma,
} from '@prisma/client';
import crypto from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import { ACCOUNTING_ACCOUNTS } from '../accounting-accounts.config';
import { AccountingEntryService } from '../accounting-entry/accounting-entry.service';
import { getNextLineNumber } from '../accounting-entry/accounting-entry.utils';
import { CashAccountingLinksService } from '../cash-accounting-links/cash-accounting-links.service';
import { CurrencyRateService } from '../currency-rates/currency-rate.service';
import { MoneyTransactionsService } from '../money-transactions/money-transactions.service';
import { PostingRunsService } from '../posting-runs/posting-runs.service';
import { AccountingValidationService } from '../accounting-validation.service';

@Injectable()
export class CashTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyRates: CurrencyRateService,
    private readonly accounting: AccountingEntryService,
    private readonly cashLinks: CashAccountingLinksService,
    private readonly moneyTx: MoneyTransactionsService,
    private readonly postingRuns: PostingRunsService,
    private readonly validation: AccountingValidationService,
  ) {}

  private getTolerance(amount: Prisma.Decimal): Prisma.Decimal {
    const pct = amount.mul(new Prisma.Decimal('0.005'));
    const one = new Prisma.Decimal(1);
    return pct.gt(one) ? pct : one;
  }

  async pairMarketplacePayout(params: {
    walletStatementLineId: string;
    bankStatementLineId: string;
    provider?: string | null;
    externalRef?: string | null;
  }) {
    const [walletLine, bankLine] = await Promise.all([
      this.prisma.statementLine.findUnique({
        where: { id: params.walletStatementLineId },
        include: { account: true, statement: true },
      }),
      this.prisma.statementLine.findUnique({
        where: { id: params.bankStatementLineId },
        include: { account: true, statement: true },
      }),
    ]);
    if (!walletLine)
      throw new NotFoundException('walletStatementLine not found');
    if (!bankLine) throw new NotFoundException('bankStatementLine not found');

    if (
      !walletLine.postedMoneyTransactionId ||
      walletLine.status !== 'POSTED'
    ) {
      throw new ConflictException('wallet line must be POSTED');
    }
    if (!bankLine.postedMoneyTransactionId || bankLine.status !== 'POSTED') {
      throw new ConflictException('bank line must be POSTED');
    }
    if (
      (walletLine as any).isSplitParent ||
      walletLine.status === ((StatementLineStatus as any).SPLIT ?? 'SPLIT')
    ) {
      throw new ConflictException(
        'wallet line is SPLIT parent; pair children instead',
      );
    }
    if (
      (bankLine as any).isSplitParent ||
      bankLine.status === ((StatementLineStatus as any).SPLIT ?? 'SPLIT')
    ) {
      throw new ConflictException(
        'bank line is SPLIT parent; pair children instead',
      );
    }

    if (walletLine.legalEntityId !== bankLine.legalEntityId) {
      throw new BadRequestException('legalEntity mismatch');
    }

    if (walletLine.currency !== bankLine.currency)
      throw new BadRequestException('currency mismatch');
    if (walletLine.direction !== MoneyTransactionDirection.OUT) {
      throw new BadRequestException('wallet line must be OUT');
    }
    if (bankLine.direction !== MoneyTransactionDirection.IN) {
      throw new BadRequestException('bank line must be IN');
    }

    if (walletLine.account.type !== FinancialAccountType.MARKETPLACE_WALLET) {
      throw new BadRequestException(
        'wallet line account must be MARKETPLACE_WALLET',
      );
    }
    if (
      bankLine.account.type !== FinancialAccountType.BANK_ACCOUNT &&
      bankLine.account.type !== FinancialAccountType.ACQUIRING_ACCOUNT
    ) {
      throw new BadRequestException(
        'bank line account must be BANK_ACCOUNT (or ACQUIRING_ACCOUNT)',
      );
    }

    const amountWallet = new Prisma.Decimal(walletLine.amount as any);
    const amountBank = new Prisma.Decimal(bankLine.amount as any);
    const tol = this.getTolerance(amountWallet);
    if (amountBank.sub(amountWallet).abs().gt(tol)) {
      throw new BadRequestException('amount mismatch (out of tolerance)');
    }

    // occurredAt: use bank line as settlement date (fallback to max)
    const occurredAt =
      bankLine.occurredAt >= walletLine.occurredAt
        ? bankLine.occurredAt
        : walletLine.occurredAt;

    const amountBase = await this.currencyRates.convertToBase({
      amount: amountWallet,
      currency: walletLine.currency,
      date: occurredAt,
    });

    // Idempotency: if same pair already linked, return it
    const existing = await this.prisma.cashTransfer.findFirst({
      where: {
        walletStatementLineId: walletLine.id,
        bankStatementLineId: bankLine.id,
      } as any,
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    // Soft uniqueness by (legalEntityId, provider, externalRef) if provided
    const provider = params.provider?.trim() || null;
    const externalRef = params.externalRef?.trim() || null;
    if (provider && externalRef) {
      const dupe = await this.prisma.cashTransfer.findFirst({
        where: {
          legalEntityId: walletLine.legalEntityId,
          provider,
          externalRef,
        } as any,
        select: { id: true },
      });
      if (dupe)
        return await this.prisma.cashTransfer.findUnique({
          where: { id: dupe.id },
        });
    }

    return this.prisma.cashTransfer.create({
      data: {
        id: crypto.randomUUID(),
        legalEntityId: walletLine.legalEntityId,
        fromAccountId: walletLine.accountId,
        toAccountId: bankLine.accountId,
        occurredAt,
        amount: amountWallet,
        currency: walletLine.currency,
        amountBase,
        provider,
        externalRef,
        walletStatementLineId: walletLine.id,
        bankStatementLineId: bankLine.id,
        status: CashTransferStatus.PAIRED,
      } as any,
    });
  }

  async postTransfer(transferId: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.cashTransfer.findUnique({
        where: { id: transferId },
      });
      if (!transfer) throw new NotFoundException('CashTransfer not found');
      if (
        transfer.status !== CashTransferStatus.PAIRED &&
        transfer.status !== CashTransferStatus.POSTED
      ) {
        throw new ConflictException('Transfer is not in a postable status');
      }

      if (!transfer.walletStatementLineId || !transfer.bankStatementLineId) {
        throw new ConflictException('Transfer is not paired');
      }

      const [walletLine, bankLine] = await Promise.all([
        tx.statementLine.findUnique({
          where: { id: transfer.walletStatementLineId },
        }),
        tx.statementLine.findUnique({
          where: { id: transfer.bankStatementLineId },
        }),
      ]);
      if (!walletLine)
        throw new NotFoundException('wallet statement line not found');
      if (!bankLine)
        throw new NotFoundException('bank statement line not found');

      if (
        walletLine.status !== 'POSTED' ||
        !walletLine.postedMoneyTransactionId
      ) {
        throw new ConflictException('wallet line must be POSTED');
      }
      if (bankLine.status !== 'POSTED' || !bankLine.postedMoneyTransactionId) {
        throw new ConflictException('bank line must be POSTED');
      }

      // Ensure moneyTx exist (should, but validate)
      const [walletMoneyTx, bankMoneyTx] = await Promise.all([
        tx.moneyTransaction.findUnique({
          where: { id: walletLine.postedMoneyTransactionId },
        }),
        tx.moneyTransaction.findUnique({
          where: { id: bankLine.postedMoneyTransactionId },
        }),
      ]);
      if (!walletMoneyTx)
        throw new NotFoundException('wallet postedMoneyTransaction not found');
      if (!bankMoneyTx)
        throw new NotFoundException('bank postedMoneyTransaction not found');

      const docType = AccountingDocType.MARKETPLACE_PAYOUT_TRANSFER;
      const docId = transfer.id;

      const run = await this.postingRuns.getOrCreatePostedRun({
        tx,
        legalEntityId: transfer.legalEntityId,
        docType,
        docId,
      });

      // Idempotency: if run already produced entries, return them (truth = PostingRun).
      const existingEntries = await tx.accountingEntry.findMany({
        where: { postingRunId: run.id } as any,
        orderBy: [{ lineNumber: 'asc' }],
      });
      if (existingEntries.length) {
        await this.validation.maybeValidateDocumentBalanceOnPost({
          tx,
          docType,
          docId,
          postingRunId: run.id,
        });
        const updated =
          transfer.status === CashTransferStatus.POSTED
            ? transfer
            : await tx.cashTransfer.update({
                where: { id: transfer.id },
                data: { status: CashTransferStatus.POSTED } as any,
              });
        return {
          transfer: updated,
          postingRunId: run.id,
          idempotent: true,
          entries: existingEntries,
        };
      }

      // Two-line accounting via clearing
      const baseLineNumber = await getNextLineNumber(tx, docType, docId);
      const outLineNumber = baseLineNumber;
      const outEntry = await this.accounting.createEntry({
        tx,
        docType,
        docId,
        legalEntityId: transfer.legalEntityId,
        lineNumber: outLineNumber,
        postingDate: transfer.occurredAt,
        debitAccount: ACCOUNTING_ACCOUNTS.CASH_TRANSFER_CLEARING,
        creditAccount: ACCOUNTING_ACCOUNTS.CASH_EQUIVALENTS,
        amount: transfer.amount,
        currency: transfer.currency,
        description: `Marketplace payout transfer ${transfer.id} (out)`,
        metadata: {
          docLineId: `cash_transfer:${transfer.id}:out`,
          transferId: transfer.id,
          fromAccountId: transfer.fromAccountId,
          toAccountId: transfer.toAccountId,
          walletStatementLineId: transfer.walletStatementLineId,
          bankStatementLineId: transfer.bankStatementLineId,
          provider: transfer.provider,
          externalRef: transfer.externalRef,
        },
        postingRunId: run.id,
      });

      const inLineNumber = baseLineNumber + 1;
      const inEntry = await this.accounting.createEntry({
        tx,
        docType,
        docId,
        legalEntityId: transfer.legalEntityId,
        lineNumber: inLineNumber,
        postingDate: transfer.occurredAt,
        debitAccount: ACCOUNTING_ACCOUNTS.CASH_EQUIVALENTS,
        creditAccount: ACCOUNTING_ACCOUNTS.CASH_TRANSFER_CLEARING,
        amount: transfer.amount,
        currency: transfer.currency,
        description: `Marketplace payout transfer ${transfer.id} (in)`,
        metadata: {
          docLineId: `cash_transfer:${transfer.id}:in`,
          transferId: transfer.id,
          fromAccountId: transfer.fromAccountId,
          toAccountId: transfer.toAccountId,
          walletStatementLineId: transfer.walletStatementLineId,
          bankStatementLineId: transfer.bankStatementLineId,
          provider: transfer.provider,
          externalRef: transfer.externalRef,
        },
        postingRunId: run.id,
      });

      // Link cash ↔ ledger
      await this.cashLinks.link({
        tx,
        moneyTransactionId: walletMoneyTx.id,
        accountingEntryId: outEntry.id,
        role: CashAccountingLinkRole.TRANSFER,
      });
      await this.cashLinks.link({
        tx,
        moneyTransactionId: bankMoneyTx.id,
        accountingEntryId: inEntry.id,
        role: CashAccountingLinkRole.TRANSFER,
      });

      await this.validation.maybeValidateDocumentBalanceOnPost({
        tx,
        docType,
        docId,
        postingRunId: run.id,
      });

      const updated = await tx.cashTransfer.update({
        where: { id: transfer.id },
        data: { status: CashTransferStatus.POSTED } as any,
      });

      return {
        transfer: updated,
        postingRunId: run.id,
        entries: { outEntry, inEntry },
      };
    });
  }

  async voidTransfer(transferId: string, reason: string) {
    const reasonText = (reason ?? '').trim() || 'void';

    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.cashTransfer.findUnique({
        where: { id: transferId },
      });
      if (!transfer) throw new NotFoundException('CashTransfer not found');
      if (transfer.status === CashTransferStatus.CANCELED) {
        return {
          transferId: transfer.id,
          status: transfer.status,
          alreadyVoided: true,
        };
      }
      if (!transfer.walletStatementLineId || !transfer.bankStatementLineId) {
        throw new ConflictException('Transfer is not paired');
      }

      const [walletLine, bankLine] = await Promise.all([
        tx.statementLine.findUnique({
          where: { id: transfer.walletStatementLineId },
          select: {
            id: true,
            status: true,
            postedMoneyTransactionId: true,
          } as any,
        }),
        tx.statementLine.findUnique({
          where: { id: transfer.bankStatementLineId },
          select: {
            id: true,
            status: true,
            postedMoneyTransactionId: true,
          } as any,
        }),
      ]);
      if (!walletLine)
        throw new NotFoundException('wallet statement line not found');
      if (!bankLine)
        throw new NotFoundException('bank statement line not found');
      if (
        !walletLine.postedMoneyTransactionId ||
        (walletLine as any).status !== 'POSTED'
      ) {
        throw new ConflictException('wallet line must be POSTED');
      }
      if (
        !bankLine.postedMoneyTransactionId ||
        (bankLine as any).status !== 'POSTED'
      ) {
        throw new ConflictException('bank line must be POSTED');
      }

      const legTxIds = [
        walletLine.postedMoneyTransactionId,
        bankLine.postedMoneyTransactionId,
      ];

      // Safety: disallow void if any additional POSTED statement line is reconciled to those moneyTx legs.
      // (We ignore the transfer's own statement lines.)
      const reconciledOtherLine = await (tx as any).statementLine.findFirst({
        where: {
          status: StatementLineStatus.POSTED,
          postedMoneyTransactionId: { in: legTxIds },
          id: { notIn: [walletLine.id, bankLine.id] },
        } as any,
        select: { id: true },
      });
      if (reconciledOtherLine) {
        throw new ConflictException(
          'reconciled cash cannot be voided; create adjustment instead',
        );
      }

      // Idempotency: if already voided (original run VOIDED and points to reversalRunId), return it.
      const voidedOriginal = await (tx as any).accountingPostingRun.findFirst({
        where: {
          legalEntityId: transfer.legalEntityId,
          docType: AccountingDocType.MARKETPLACE_PAYOUT_TRANSFER,
          docId: transfer.id,
          status: 'VOIDED',
          reversalRunId: { not: null },
        } as any,
        orderBy: [{ version: 'desc' }],
        select: { id: true, reversalRunId: true },
      });
      if (voidedOriginal?.reversalRunId) {
        await tx.cashTransfer.update({
          where: { id: transfer.id },
          data: { status: CashTransferStatus.CANCELED } as any,
        });
        await tx.moneyTransaction.updateMany({
          where: { id: { in: legTxIds } } as any,
          data: {
            status: 'VOIDED',
            voidedAt: new Date(),
            voidReason: reasonText,
          } as any,
        });
        return {
          transferId: transfer.id,
          status: CashTransferStatus.CANCELED,
          alreadyVoided: true,
          originalRunId: voidedOriginal.id,
          reversalRunId: voidedOriginal.reversalRunId,
        };
      }

      // Find the active POSTED run to void, excluding reversal runs (those referenced by a VOIDED original).
      const reversalIds = await (tx as any).accountingPostingRun.findMany({
        where: {
          legalEntityId: transfer.legalEntityId,
          docType: AccountingDocType.MARKETPLACE_PAYOUT_TRANSFER,
          docId: transfer.id,
          status: 'VOIDED',
          reversalRunId: { not: null },
        } as any,
        select: { reversalRunId: true },
      });
      const reversalRunIds = reversalIds
        .map((r: any) => r.reversalRunId)
        .filter(Boolean);

      const run = await (tx as any).accountingPostingRun.findFirst({
        where: {
          legalEntityId: transfer.legalEntityId,
          docType: AccountingDocType.MARKETPLACE_PAYOUT_TRANSFER,
          docId: transfer.id,
          status: 'POSTED',
          ...(reversalRunIds.length ? { id: { notIn: reversalRunIds } } : {}),
        } as any,
        orderBy: [{ version: 'desc' }],
      });
      if (!run)
        throw new ConflictException(
          'No active PostingRun found for cash transfer',
        );

      const voidRes = await this.postingRuns.voidRun({
        tx,
        runId: run.id,
        reason: reasonText,
      });

      await tx.moneyTransaction.updateMany({
        where: { id: { in: legTxIds } } as any,
        data: {
          status: 'VOIDED',
          voidedAt: new Date(),
          voidReason: reasonText,
        } as any,
      });

      const updated = await tx.cashTransfer.update({
        where: { id: transfer.id },
        data: { status: CashTransferStatus.CANCELED } as any,
      });

      return {
        transfer: updated,
        originalRunId: run.id,
        reversalRunId: voidRes.reversalRun?.id ?? null,
        alreadyVoided: false,
      };
    });
  }

  async list(params: {
    legalEntityId: string;
    from?: Date;
    to?: Date;
    status?: CashTransferStatus;
    provider?: string;
  }) {
    if (!params.legalEntityId)
      throw new BadRequestException('legalEntityId is required');
    const where: Prisma.CashTransferWhereInput = {
      legalEntityId: params.legalEntityId,
    } as any;
    if (params.status) (where as any).status = params.status;
    if (params.provider) (where as any).provider = params.provider;
    if (params.from || params.to) {
      (where as any).occurredAt = {};
      if (params.from) (where as any).occurredAt.gte = params.from;
      if (params.to) (where as any).occurredAt.lte = params.to;
    }
    const transfers = await this.prisma.cashTransfer.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        fromAccount: true,
        toAccount: true,
        walletStatementLine: true,
        bankStatementLine: true,
      } as any,
    });

    const ids = transfers.map((t) => t.id);
    if (!ids.length) return transfers as any;

    const runs = await (this.prisma as any).accountingPostingRun.findMany({
      where: {
        legalEntityId: params.legalEntityId,
        docType: AccountingDocType.MARKETPLACE_PAYOUT_TRANSFER,
        docId: { in: ids },
      } as any,
      orderBy: [{ docId: 'asc' }, { version: 'desc' }],
      select: { id: true, docId: true, status: true, reversalRunId: true },
    });

    const latestPostedByDocId = new Map<
      string,
      { id: string; status: string }
    >();
    const voidedOriginalByDocId = new Map<
      string,
      { id: string; reversalRunId: string }
    >();
    for (const r of runs) {
      if (r.status === 'VOIDED' && r.reversalRunId) {
        if (!voidedOriginalByDocId.has(r.docId))
          voidedOriginalByDocId.set(r.docId, {
            id: r.id,
            reversalRunId: r.reversalRunId,
          });
      }
      if (!latestPostedByDocId.has(r.docId) && r.status === 'POSTED') {
        latestPostedByDocId.set(r.docId, { id: r.id, status: r.status });
      }
    }

    return transfers.map((t: any) => {
      const voided = voidedOriginalByDocId.get(t.id);
      const posted = latestPostedByDocId.get(t.id);
      const walletTxId =
        t.walletStatementLine?.postedMoneyTransactionId ?? null;
      const bankTxId = t.bankStatementLine?.postedMoneyTransactionId ?? null;
      return {
        ...t,
        postingRunId: voided ? voided.id : (posted?.id ?? null),
        postingRunStatus: voided ? 'VOIDED' : (posted?.status ?? null),
        moneyTransactionIds: [walletTxId, bankTxId].filter(Boolean),
      };
    }) as any;
  }
}
