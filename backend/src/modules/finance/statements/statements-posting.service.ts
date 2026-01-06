import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AccountingDocType,
  CashAccountingLinkRole,
  FinancialAccountType,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  Prisma,
  StatementLinePostedMode,
  StatementLineStatus,
  StatementProvider,
} from '@prisma/client';
import crypto from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import { ACCOUNTING_ACCOUNTS } from '../accounting-accounts.config';
import { AccountingEntryService } from '../accounting-entry/accounting-entry.service';
import {
  buildMarketplaceFeeKey,
  normalizeMarketplaceFeeCode,
  normalizeMarketplaceProvider,
} from '../marketplace-fee-key';
import { FinanceCategoryResolverService } from '../category-default-mappings/category-resolver.service';
import { CashAccountingLinksService } from '../cash-accounting-links/cash-accounting-links.service';
import { PostingRunsService } from '../posting-runs/posting-runs.service';
import { CurrencyRateService } from '../currency-rates/currency-rate.service';
import { MoneyTransactionsService } from '../money-transactions/money-transactions.service';
import { StatementMatchingService } from './statement-matching.service';
import { AccountingValidationService } from '../accounting-validation.service';

type MatchEntityType = 'PAYMENT_EXECUTION' | 'MONEY_TRANSACTION';

function diffDays(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / 86_400_000);
}

@Injectable()
export class StatementsPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moneyTx: MoneyTransactionsService,
    private readonly cashLinks: CashAccountingLinksService,
    private readonly accountingEntries: AccountingEntryService,
    private readonly currencyRates: CurrencyRateService,
    private readonly matcher: StatementMatchingService,
    private readonly categoryResolver: FinanceCategoryResolverService,
    private readonly postingRuns: PostingRunsService,
    private readonly validation: AccountingValidationService,
  ) {}

  private getDateWindowDays(provider: StatementProvider): number {
    if (
      provider === StatementProvider.ACQUIRING ||
      provider === StatementProvider.MARKETPLACE
    ) {
      return 14;
    }
    return 5;
  }

  private getTolerance(amount: Prisma.Decimal): Prisma.Decimal {
    const pct = amount.mul(new Prisma.Decimal('0.005')); // 0.5%
    const one = new Prisma.Decimal(1);
    return pct.gt(one) ? pct : one;
  }

  private assertWithinTolerance(params: {
    lineAmount: Prisma.Decimal;
    candidateAmount: Prisma.Decimal;
    tolerance: Prisma.Decimal;
  }) {
    const diff = params.candidateAmount.sub(params.lineAmount).abs();
    if (diff.gt(params.tolerance)) {
      throw new BadRequestException('amount mismatch (out of tolerance)');
    }
  }

  private assertDateWindow(params: {
    provider: StatementProvider;
    a: Date;
    b: Date;
  }) {
    const window = this.getDateWindowDays(params.provider);
    const d = diffDays(params.a, params.b);
    if (d > window) {
      throw new BadRequestException('date mismatch (out of window)');
    }
  }

  async confirmMatch(
    lineId: string,
    match: { entityType: MatchEntityType; entityId: string },
  ) {
    const line = await this.prisma.statementLine.findUnique({
      where: { id: lineId },
      include: { statement: { select: { provider: true } } },
    });
    if (!line) throw new NotFoundException('StatementLine not found');

    if (
      (line as any).isSplitParent ||
      line.status === (StatementLineStatus as any).SPLIT
    ) {
      throw new ConflictException(
        'Line is SPLIT parent; match children instead',
      );
    }

    if (
      line.status !== StatementLineStatus.NEW &&
      line.status !== StatementLineStatus.SUGGESTED &&
      line.status !== StatementLineStatus.ERROR
    ) {
      throw new ConflictException(
        'Only NEW/SUGGESTED/ERROR line can be confirmed',
      );
    }
    if (!match.entityId) throw new BadRequestException('entityId is required');

    const provider = (line as any).statement?.provider as
      | StatementProvider
      | undefined;
    const p = provider ?? StatementProvider.BANK;

    const lineAmount = new Prisma.Decimal(line.amount as any);
    const tol = this.getTolerance(lineAmount);

    if (match.entityType === 'PAYMENT_EXECUTION') {
      const exec = await this.prisma.paymentExecution.findUnique({
        where: { id: match.entityId },
      });
      if (!exec) throw new NotFoundException('PaymentExecution not found');

      if (line.legalEntityId !== exec.legalEntityId) {
        throw new BadRequestException('legalEntity mismatch');
      }
      if (line.currency !== exec.currency)
        throw new BadRequestException('currency mismatch');
      if (line.direction !== MoneyTransactionDirection.OUT) {
        throw new BadRequestException('direction mismatch');
      }
      if (line.accountId !== exec.fromAccountId) {
        throw new BadRequestException('account mismatch');
      }
      this.assertWithinTolerance({
        lineAmount,
        candidateAmount: new Prisma.Decimal(exec.amount as any),
        tolerance: tol,
      });
      this.assertDateWindow({
        provider: p,
        a: line.occurredAt,
        b: exec.executedAt,
      });

      return this.prisma.statementLine.update({
        where: { id: line.id },
        data: {
          matchedEntityType: 'PAYMENT_EXECUTION',
          matchedEntityId: exec.id,
          status: StatementLineStatus.MATCHED,
          errorMessage: null,
        } as any,
      });
    }

    if (match.entityType === 'MONEY_TRANSACTION') {
      const tx = await this.prisma.moneyTransaction.findUnique({
        where: { id: match.entityId },
        include: { account: { select: { legalEntityId: true } } },
      });
      if (!tx) throw new NotFoundException('MoneyTransaction not found');

      if (tx.accountId !== line.accountId)
        throw new BadRequestException('account mismatch');
      if (tx.account.legalEntityId !== line.legalEntityId) {
        throw new BadRequestException('legalEntity mismatch');
      }
      if (tx.currency !== line.currency)
        throw new BadRequestException('currency mismatch');
      if (tx.direction !== line.direction)
        throw new BadRequestException('direction mismatch');
      this.assertWithinTolerance({
        lineAmount,
        candidateAmount: new Prisma.Decimal(tx.amount as any),
        tolerance: tol,
      });
      this.assertDateWindow({
        provider: p,
        a: line.occurredAt,
        b: tx.occurredAt,
      });

      return this.prisma.statementLine.update({
        where: { id: line.id },
        data: {
          matchedEntityType: 'MONEY_TRANSACTION',
          matchedEntityId: tx.id,
          status: StatementLineStatus.MATCHED,
          errorMessage: null,
        } as any,
      });
    }

    throw new BadRequestException('Unsupported entityType');
  }

  async postLine(lineId: string) {
    return this.prisma.$transaction(async (tx) => {
      const line = await tx.statementLine.findUnique({
        where: { id: lineId },
        include: {
          statement: { select: { provider: true } },
          account: { select: { type: true, provider: true } },
        } as any,
      });
      if (!line) throw new NotFoundException('StatementLine not found');

      if (
        (line as any).isSplitParent ||
        line.status === (StatementLineStatus as any).SPLIT
      ) {
        throw new ConflictException(
          'Line is SPLIT parent; post children instead',
        );
      }

      if (line.status === StatementLineStatus.POSTED && line.postedAt) {
        const postedMoneyTxId = (line as any).postedMoneyTransactionId as
          | string
          | null;
        if (postedMoneyTxId) {
          const fee = await this.ensureMarketplaceFeePosting({
            tx,
            line,
            moneyTransactionId: postedMoneyTxId,
          });
          if (fee?.mode && (line as any).postedMode !== fee.mode) {
            await tx.statementLine.update({
              where: { id: line.id },
              data: { postedMode: fee.mode } as any,
            });
          }
        }
        return { lineId: line.id, status: line.status, idempotent: true };
      }

      if (line.status !== StatementLineStatus.MATCHED) {
        throw new ConflictException('Only MATCHED line can be posted');
      }

      if (!line.matchedEntityType || !line.matchedEntityId) {
        throw new ConflictException(
          'Line is MATCHED but has no matchedEntity*',
        );
      }

      const lineAmount = new Prisma.Decimal(line.amount as any);
      const tol = this.getTolerance(lineAmount);
      const provider = (line as any).statement?.provider as
        | StatementProvider
        | undefined;
      const p = provider ?? StatementProvider.BANK;

      let postedMoneyTxId: string | null = null;
      let errorMessage: string | null = null;

      if (line.matchedEntityType === 'PAYMENT_EXECUTION') {
        const exec = await tx.paymentExecution.findUnique({
          where: { id: line.matchedEntityId },
        });
        if (!exec) throw new NotFoundException('PaymentExecution not found');

        // Strict checks
        if (line.direction !== MoneyTransactionDirection.OUT) {
          throw new BadRequestException('direction mismatch');
        }
        if (line.legalEntityId !== exec.legalEntityId) {
          throw new BadRequestException('legalEntity mismatch');
        }
        if (line.currency !== exec.currency)
          throw new BadRequestException('currency mismatch');
        if (line.accountId !== exec.fromAccountId)
          throw new BadRequestException('account mismatch');
        this.assertWithinTolerance({
          lineAmount,
          candidateAmount: new Prisma.Decimal(exec.amount as any),
          tolerance: tol,
        });
        this.assertDateWindow({
          provider: p,
          a: line.occurredAt,
          b: exec.executedAt,
        });

        // Preferred: money tx created by execution
        const execMoneyTx = await tx.moneyTransaction.findFirst({
          where: {
            accountId: exec.fromAccountId,
            sourceType: MoneyTransactionSourceType.PAYMENT_EXECUTION,
            sourceId: exec.id,
          } as any,
          orderBy: [{ createdAt: 'asc' }],
        });

        if (execMoneyTx) {
          postedMoneyTxId = execMoneyTx.id;
        } else {
          // Edge-case fallback: create a StatementLine-sourced MoneyTransaction
          errorMessage =
            'No MoneyTransaction found for PaymentExecution; created STATEMENT_LINE moneyTx (manual fix may be required)';
          const created = await this.moneyTx.create({
            tx,
            accountId: line.accountId,
            occurredAt: line.occurredAt,
            direction: line.direction,
            amount: lineAmount,
            currency: line.currency,
            description: line.description ?? `Statement line ${line.id}`,
            sourceType: MoneyTransactionSourceType.STATEMENT_LINE,
            sourceId: line.id,
            idempotencyKey: `statement_line:${line.id}`,
          });
          postedMoneyTxId = created.id;
        }

        // Ensure ledger entry exists (PaymentExecution posting)
        const paymentEntry =
          (await tx.accountingEntry.findFirst({
            where: {
              docType: AccountingDocType.PAYMENT_EXECUTION,
              docId: exec.id,
              metadata: {
                path: ['docLineId'],
                equals: `payment_execution:${exec.id}:principal`,
              },
            } as any,
          })) ??
          (await tx.accountingEntry.findFirst({
            where: {
              docType: AccountingDocType.PAYMENT_EXECUTION,
              docId: exec.id,
            } as any,
            orderBy: { lineNumber: 'asc' },
          }));
        if (!paymentEntry) {
          throw new NotFoundException(
            'AccountingEntry for PAYMENT_EXECUTION not found',
          );
        }

        // Ensure cash link exists
        await this.cashLinks.link({
          tx,
          moneyTransactionId: postedMoneyTxId,
          accountingEntryId: paymentEntry.id,
          role: CashAccountingLinkRole.PAYMENT_PRINCIPAL,
        });
      } else if (line.matchedEntityType === 'MONEY_TRANSACTION') {
        const mt = await tx.moneyTransaction.findUnique({
          where: { id: line.matchedEntityId },
          include: { account: { select: { legalEntityId: true } } },
        });
        if (!mt) throw new NotFoundException('MoneyTransaction not found');

        if (mt.accountId !== line.accountId)
          throw new BadRequestException('account mismatch');
        if (mt.account.legalEntityId !== line.legalEntityId) {
          throw new BadRequestException('legalEntity mismatch');
        }
        if (mt.currency !== line.currency)
          throw new BadRequestException('currency mismatch');
        if (mt.direction !== line.direction)
          throw new BadRequestException('direction mismatch');
        this.assertWithinTolerance({
          lineAmount,
          candidateAmount: new Prisma.Decimal(mt.amount as any),
          tolerance: tol,
        });
        this.assertDateWindow({
          provider: p,
          a: line.occurredAt,
          b: mt.occurredAt,
        });

        postedMoneyTxId = mt.id;
      } else {
        throw new BadRequestException('Unsupported matchedEntityType');
      }

      const fee = await this.ensureMarketplaceFeePosting({
        tx,
        line,
        moneyTransactionId: postedMoneyTxId,
      });

      const updated = await tx.statementLine.update({
        where: { id: line.id },
        data: {
          postedMoneyTransactionId: postedMoneyTxId,
          postedAt: new Date(),
          status: StatementLineStatus.POSTED,
          errorMessage,
          postedMode: fee?.mode ?? null,
          feeVoidedAt: null,
          feeVoidReason: null,
        } as any,
      });

      return { line: updated, postedMoneyTransactionId: postedMoneyTxId };
    });
  }

  private isMarketplaceFeeOperationTypeHint(
    hint: string | null | undefined,
  ): boolean {
    const v = (hint ?? '').trim().toUpperCase();
    if (!v) return false;
    return new Set([
      'FEE',
      'MARKETPLACE_FEE',
      'PENALTY',
      'SERVICE',
      'STORAGE',
      'DELIVERY',
      'ADS',
      'OTHER_FEE',
      'REFUND_FEE',
    ]).has(v);
  }

  private async resolveDefaultMarketplaceFeesCashflowCategoryId(
    tx: Prisma.TransactionClient,
  ) {
    const found = await tx.cashflowCategory.findFirst({
      where: {
        isActive: true,
        code: { in: ['MARKETPLACE_FEES', 'MARKETPLACE_FEE', 'MP_FEES'] } as any,
      } as any,
      orderBy: [{ code: 'asc' }],
    });
    return found?.id ?? null;
  }

  private async ensureMarketplaceFeePosting(params: {
    tx: Prisma.TransactionClient;
    line: any;
    moneyTransactionId: string;
  }): Promise<
    | {
        mode: StatementLinePostedMode;
        linkedEntryId: string;
        postingRunId?: string | null;
      }
    | null
    | undefined
  > {
    const line = params.line;
    const accountType = line?.account?.type as FinancialAccountType | undefined;
    if (accountType !== FinancialAccountType.MARKETPLACE_WALLET) return null;
    if (line.direction !== MoneyTransactionDirection.OUT) return null;

    if (!this.isMarketplaceFeeOperationTypeHint(line.operationTypeHint))
      return null;

    const provider =
      normalizeMarketplaceProvider(line?.account?.provider ?? null) ??
      (typeof line.feeKey === 'string' && line.feeKey.includes(':')
        ? normalizeMarketplaceProvider(String(line.feeKey).split(':')[0])
        : null);
    const feeCode = normalizeMarketplaceFeeCode(
      line.externalOperationCode ?? null,
    );
    const docLineId = `statement_line:${line.id}:fee`;
    const computedFeeKey =
      typeof line.feeKey === 'string' && line.feeKey.trim()
        ? line.feeKey.trim()
        : buildMarketplaceFeeKey({
            provider,
            feeCode,
            orderId: line.marketplaceOrderId ?? null,
            operationId: null,
            docLineId,
          });

    const baseAmount = new Prisma.Decimal(line.amountBase);
    const tolBase = this.getTolerance(baseAmount);
    const windowDays = this.getDateWindowDays(StatementProvider.MARKETPLACE);
    const from = new Date(line.occurredAt);
    from.setDate(from.getDate() - windowDays);
    const to = new Date(line.occurredAt);
    to.setDate(to.getDate() + windowDays);

    // Try to link to existing entry (anti-double-count)
    const metaFilters: any[] = [];
    // 0) feeKey-first
    if (computedFeeKey) {
      const feeKeyCandidates = await params.tx.accountingEntry.findMany({
        where: {
          legalEntityId: line.legalEntityId,
          debitAccount: ACCOUNTING_ACCOUNTS.MARKETPLACE_FEES,
          postingDate: { gte: from, lte: to },
          metadata: {
            path: ['marketplace', 'feeKey'],
            equals: computedFeeKey,
          } as any,
        } as any,
        orderBy: [{ postingDate: 'desc' }],
        take: 50,
      });
      const feeKeyMatched = feeKeyCandidates.find((e) => {
        const eBase = new Prisma.Decimal((e as any).amountBase);
        return eBase.sub(baseAmount).abs().lte(tolBase);
      });
      if (feeKeyMatched) {
        await this.cashLinks.link({
          tx: params.tx,
          moneyTransactionId: params.moneyTransactionId,
          accountingEntryId: feeKeyMatched.id,
          role: CashAccountingLinkRole.FEE,
        });
        return {
          mode: StatementLinePostedMode.FEE_LINK_ONLY,
          linkedEntryId: feeKeyMatched.id,
        };
      }
    }

    // 1) fallback matching (provider/orderId/feeCode + amount/date)
    if (provider) {
      metaFilters.push({
        metadata: {
          path: ['marketplace', 'provider'],
          equals: provider,
        } as any,
      });
    }
    if (line.marketplaceOrderId) {
      metaFilters.push({
        metadata: {
          path: ['marketplace', 'orderId'],
          equals: line.marketplaceOrderId,
        } as any,
      });
    }
    if (feeCode) {
      metaFilters.push({
        metadata: { path: ['marketplace', 'feeCode'], equals: feeCode } as any,
      });
    }

    const baseWhere: any = {
      legalEntityId: line.legalEntityId,
      debitAccount: ACCOUNTING_ACCOUNTS.MARKETPLACE_FEES,
      postingDate: { gte: from, lte: to },
    };

    const where: any =
      line.saleDocumentId && metaFilters.length
        ? {
            ...baseWhere,
            OR: [
              {
                docType: AccountingDocType.SALES_DOCUMENT,
                docId: line.saleDocumentId,
              },
              { AND: metaFilters },
            ],
          }
        : line.saleDocumentId
          ? {
              ...baseWhere,
              docType: AccountingDocType.SALES_DOCUMENT,
              docId: line.saleDocumentId,
            }
          : metaFilters.length
            ? { ...baseWhere, AND: metaFilters }
            : baseWhere;

    const candidates = await params.tx.accountingEntry.findMany({
      where,
      orderBy: [{ postingDate: 'desc' }],
      take: 50,
    });

    const matchedExisting = candidates.find((e) => {
      const eBase = new Prisma.Decimal((e as any).amountBase);
      return eBase.sub(baseAmount).abs().lte(tolBase);
    });

    if (matchedExisting) {
      await this.cashLinks.link({
        tx: params.tx,
        moneyTransactionId: params.moneyTransactionId,
        accountingEntryId: matchedExisting.id,
        role: CashAccountingLinkRole.FEE,
      });
      return {
        mode: StatementLinePostedMode.FEE_LINK_ONLY,
        linkedEntryId: matchedExisting.id,
      };
    }

    // Not found -> create fee entry
    let cashflowCategoryId =
      (line.cashflowCategoryId as string | null | undefined) ??
      (await this.resolveDefaultMarketplaceFeesCashflowCategoryId(params.tx));
    if (!cashflowCategoryId) {
      const resolved = await this.categoryResolver.resolveDefaults({
        legalEntityId: line.legalEntityId,
        sourceType: 'STATEMENT_OPERATION_HINT' as any,
        sourceCode: 'MARKETPLACE_FEE',
      });
      cashflowCategoryId = resolved.cashflowCategoryId;
    }
    if (!cashflowCategoryId) {
      throw new UnprocessableEntityException(
        'cashflowCategoryId is required for marketplace fee posting',
      );
    }

    const run = await this.postingRuns.getOrCreatePostedRun({
      tx: params.tx,
      legalEntityId: line.legalEntityId,
      docType: AccountingDocType.STATEMENT_LINE_FEE,
      docId: line.id,
    });

    const existingEntries = await params.tx.accountingEntry.findMany({
      where: { postingRunId: run.id } as any,
      orderBy: [{ lineNumber: 'asc' }],
    });

    const entry =
      existingEntries[0] ??
      (await this.accountingEntries.createEntry({
        tx: params.tx,
        docType: AccountingDocType.STATEMENT_LINE_FEE,
        docId: line.id,
        sourceDocType: line.saleDocumentId
          ? AccountingDocType.SALES_DOCUMENT
          : undefined,
        sourceDocId: line.saleDocumentId ?? undefined,
        legalEntityId: line.legalEntityId,
        lineNumber: 1,
        postingDate: new Date(line.occurredAt),
        debitAccount: ACCOUNTING_ACCOUNTS.MARKETPLACE_FEES,
        creditAccount: ACCOUNTING_ACCOUNTS.CASH_EQUIVALENTS,
        amount: new Prisma.Decimal(line.amount),
        currency: line.currency,
        description:
          line.description ??
          `Marketplace fee (${line.operationTypeHint ?? 'FEE'})`,
        metadata: {
          docLineId: `statement_line_fee:${line.id}:fee`,
          statementLineId: line.id,
          accountId: line.accountId,
          cashflowCategoryId,
          marketplace: {
            provider: provider ?? null,
            feeCode: feeCode ?? null,
            orderId: line.marketplaceOrderId ?? null,
            operationId: null,
            feeKey: computedFeeKey ?? null,
          },
        },
        postingRunId: run.id,
      }));

    await this.validation.maybeValidateDocumentBalanceOnPost({
      tx: params.tx,
      docType: AccountingDocType.STATEMENT_LINE_FEE,
      docId: line.id,
      postingRunId: run.id,
    });

    await this.cashLinks.link({
      tx: params.tx,
      moneyTransactionId: params.moneyTransactionId,
      accountingEntryId: entry.id,
      role: CashAccountingLinkRole.FEE,
    });
    return {
      mode: StatementLinePostedMode.FEE_ENTRY_CREATED,
      linkedEntryId: entry.id,
      postingRunId: run.id,
    };
  }

  async voidFeePosting(lineId: string, reason: string) {
    const reasonText = (reason ?? '').trim() || 'void';
    return this.prisma.$transaction(async (tx) => {
      const line = await tx.statementLine.findUnique({
        where: { id: lineId },
        include: {
          statement: { select: { provider: true } },
          account: { select: { type: true, provider: true } },
        } as any,
      });
      if (!line) throw new NotFoundException('StatementLine not found');

      if (line.status !== StatementLineStatus.POSTED || !line.postedAt) {
        throw new ConflictException('Only POSTED line can void fee posting');
      }
      const postedMoneyTxId = (line as any).postedMoneyTransactionId as
        | string
        | null;
      if (!postedMoneyTxId) {
        throw new ConflictException('postedMoneyTransactionId is required');
      }

      const mode =
        ((line as any).postedMode as
          | StatementLinePostedMode
          | null
          | undefined) ??
        (await (async () => {
          const exists = await tx.accountingEntry.findFirst({
            where: {
              docType: AccountingDocType.STATEMENT_LINE_FEE,
              docId: line.id,
            } as any,
            select: { id: true },
          });
          return exists
            ? StatementLinePostedMode.FEE_ENTRY_CREATED
            : StatementLinePostedMode.FEE_LINK_ONLY;
        })());

      if (mode === StatementLinePostedMode.FEE_LINK_ONLY) {
        // Unlink-only: remove fee cash links and revert line to MATCHED for re-post
        const feeLinks = await tx.cashAccountingLink.findMany({
          where: {
            moneyTransactionId: postedMoneyTxId,
            role: CashAccountingLinkRole.FEE,
          } as any,
          select: { accountingEntryId: true },
        });
        for (const l of feeLinks as any[]) {
          await this.cashLinks.unlink({
            tx,
            moneyTransactionId: postedMoneyTxId,
            accountingEntryId: l.accountingEntryId,
            role: CashAccountingLinkRole.FEE,
          });
        }

        const updated = await tx.statementLine.update({
          where: { id: line.id },
          data: {
            status: StatementLineStatus.MATCHED,
            postedAt: null,
            postedMoneyTransactionId: null,
            postedMode: null,
            feeVoidedAt: new Date(),
            feeVoidReason: reasonText,
          } as any,
        });
        return { mode, line: updated, unlinked: feeLinks.length };
      }

      // Fee-entry-created: void posting run (reversal entries)
      const existingVoided = await tx.accountingPostingRun.findFirst({
        where: {
          legalEntityId: line.legalEntityId,
          docType: AccountingDocType.STATEMENT_LINE_FEE,
          docId: line.id,
          status: 'VOIDED',
          reversalRunId: { not: null },
        } as any,
        orderBy: [{ version: 'desc' }],
        select: { id: true, reversalRunId: true },
      });
      if (existingVoided?.reversalRunId) {
        await tx.statementLine.update({
          where: { id: line.id },
          data: {
            postedMode: StatementLinePostedMode.FEE_ENTRY_CREATED,
            feeVoidedAt: (line as any).feeVoidedAt ?? new Date(),
            feeVoidReason: (line as any).feeVoidReason ?? reasonText,
          } as any,
        });
        return {
          mode,
          alreadyVoided: true,
          originalRunId: existingVoided.id,
          reversalRunId: existingVoided.reversalRunId,
        };
      }

      const run = await this.postingRuns.getActivePostedRun({
        tx,
        legalEntityId: line.legalEntityId,
        docType: AccountingDocType.STATEMENT_LINE_FEE,
        docId: line.id,
      });
      if (!run) {
        throw new ConflictException(
          'No active PostingRun found for STATEMENT_LINE_FEE',
        );
      }
      const entry = await tx.accountingEntry.findFirst({
        where: { postingRunId: run.id } as any,
        orderBy: { lineNumber: 'asc' },
      });
      if (!entry)
        throw new NotFoundException('STATEMENT_LINE_FEE entry not found');

      const otherLinks = await tx.cashAccountingLink.findMany({
        where: { accountingEntryId: entry.id } as any,
        select: { moneyTransactionId: true, role: true },
      });
      const hasForeign = (otherLinks as any[]).some(
        (l) =>
          l.moneyTransactionId !== postedMoneyTxId ||
          l.role !== CashAccountingLinkRole.FEE,
      );
      if (hasForeign) {
        throw new ConflictException(
          'Cannot void fee posting: AccountingEntry has other cash links (not from this statement line)',
        );
      }

      const res = await this.postingRuns.voidRun({
        tx,
        runId: run.id,
        reason: reasonText,
      });
      await tx.statementLine.update({
        where: { id: line.id },
        data: {
          postedMode: StatementLinePostedMode.FEE_ENTRY_CREATED,
          feeVoidedAt: new Date(),
          feeVoidReason: reasonText,
        } as any,
      });
      return {
        mode,
        alreadyVoided: false,
        originalRunId: run.id,
        reversalRunId: (res as any).reversalRun?.id ?? null,
      };
    });
  }

  async repostFeePosting(lineId: string, reason: string) {
    const reasonText = (reason ?? '').trim() || 'repost';
    return this.prisma.$transaction(async (tx) => {
      const line = await tx.statementLine.findUnique({
        where: { id: lineId },
        include: {
          statement: { select: { provider: true } },
          account: { select: { type: true, provider: true } },
        } as any,
      });
      if (!line) throw new NotFoundException('StatementLine not found');
      if (line.status !== StatementLineStatus.POSTED || !line.postedAt) {
        throw new ConflictException('Only POSTED line can repost fee posting');
      }
      const postedMoneyTxId = (line as any).postedMoneyTransactionId as
        | string
        | null;
      if (!postedMoneyTxId)
        throw new ConflictException('postedMoneyTransactionId is required');

      const mode =
        ((line as any).postedMode as
          | StatementLinePostedMode
          | null
          | undefined) ??
        (await (async () => {
          const exists = await tx.accountingEntry.findFirst({
            where: {
              docType: AccountingDocType.STATEMENT_LINE_FEE,
              docId: line.id,
            } as any,
            select: { id: true },
          });
          return exists
            ? StatementLinePostedMode.FEE_ENTRY_CREATED
            : StatementLinePostedMode.FEE_LINK_ONLY;
        })());

      if (mode === StatementLinePostedMode.FEE_LINK_ONLY) {
        // unlink + post again (may link-only again or create-entry depending on ledger state)
        await this.voidFeePosting(lineId, reasonText);
        await tx.statementLine.update({
          where: { id: line.id },
          data: {
            status: StatementLineStatus.POSTED,
            postedAt: new Date(),
            postedMoneyTransactionId: postedMoneyTxId,
          } as any,
        });
        const fee = await this.ensureMarketplaceFeePosting({
          tx,
          line,
          moneyTransactionId: postedMoneyTxId,
        });
        await tx.statementLine.update({
          where: { id: line.id },
          data: {
            postedMode: fee?.mode ?? null,
            feeVoidedAt: null,
            feeVoidReason: null,
          } as any,
        });
        return { mode: fee?.mode ?? mode, reposted: true };
      }

      // Fee-entry-created repost: void current run (if active), then create next run + new entry version
      const latest = await tx.accountingPostingRun.findFirst({
        where: {
          legalEntityId: line.legalEntityId,
          docType: AccountingDocType.STATEMENT_LINE_FEE,
          docId: line.id,
        } as any,
        orderBy: [{ version: 'desc' }],
      });
      if (latest?.status === 'POSTED') {
        await this.postingRuns.voidRun({
          tx,
          runId: latest.id,
          reason: reasonText,
        });
      }

      const repostRun = await this.postingRuns.createNextRun({
        tx,
        legalEntityId: line.legalEntityId,
        docType: AccountingDocType.STATEMENT_LINE_FEE,
        docId: line.id,
        repostedFromRunId: latest?.id ?? null,
      });

      // Ensure the old fee links from this line to STATEMENT_LINE_FEE entries are removed, then link to new entry
      await tx.cashAccountingLink.deleteMany({
        where: {
          moneyTransactionId: postedMoneyTxId,
          role: CashAccountingLinkRole.FEE,
          accountingEntry: {
            docType: AccountingDocType.STATEMENT_LINE_FEE,
            docId: line.id,
          } as any,
        } as any,
      });

      // Re-create fee entry payload (same rule as ensureMarketplaceFeePosting)
      const provider =
        normalizeMarketplaceProvider(
          (line as any)?.account?.provider ?? null,
        ) ??
        (typeof (line as any).feeKey === 'string' &&
        String((line as any).feeKey).includes(':')
          ? normalizeMarketplaceProvider(
              String((line as any).feeKey).split(':')[0],
            )
          : null);
      const feeCode = normalizeMarketplaceFeeCode(
        (line as any).externalOperationCode ?? null,
      );
      const docLineId = `statement_line_fee:${line.id}:fee:v${repostRun.version}`;
      const computedFeeKey =
        typeof (line as any).feeKey === 'string' &&
        String((line as any).feeKey).trim()
          ? String((line as any).feeKey).trim()
          : buildMarketplaceFeeKey({
              provider,
              feeCode,
              orderId: (line as any).marketplaceOrderId ?? null,
              operationId: null,
              docLineId: `statement_line:${line.id}:fee`,
            });

      let cashflowCategoryId =
        ((line as any).cashflowCategoryId as string | null | undefined) ??
        (await this.resolveDefaultMarketplaceFeesCashflowCategoryId(tx));
      if (!cashflowCategoryId) {
        const resolved = await this.categoryResolver.resolveDefaults({
          legalEntityId: line.legalEntityId,
          sourceType: 'STATEMENT_OPERATION_HINT' as any,
          sourceCode: 'MARKETPLACE_FEE',
        });
        cashflowCategoryId = resolved.cashflowCategoryId;
      }
      if (!cashflowCategoryId) {
        throw new UnprocessableEntityException(
          'cashflowCategoryId is required for marketplace fee posting',
        );
      }

      const entry = await this.accountingEntries.createEntry({
        tx,
        docType: AccountingDocType.STATEMENT_LINE_FEE,
        docId: line.id,
        sourceDocType: (line as any).saleDocumentId
          ? AccountingDocType.SALES_DOCUMENT
          : undefined,
        sourceDocId: (line as any).saleDocumentId ?? undefined,
        legalEntityId: line.legalEntityId,
        lineNumber: 1,
        postingDate: new Date(line.occurredAt),
        debitAccount: ACCOUNTING_ACCOUNTS.MARKETPLACE_FEES,
        creditAccount: ACCOUNTING_ACCOUNTS.CASH_EQUIVALENTS,
        amount: new Prisma.Decimal(line.amount as any),
        currency: line.currency,
        description:
          line.description ??
          `Marketplace fee (${(line as any).operationTypeHint ?? 'FEE'})`,
        metadata: {
          docLineId,
          statementLineId: line.id,
          accountId: line.accountId,
          cashflowCategoryId,
          marketplace: {
            provider: provider ?? null,
            feeCode: feeCode ?? null,
            orderId: (line as any).marketplaceOrderId ?? null,
            operationId: null,
            feeKey: computedFeeKey ?? null,
          },
        },
        postingRunId: repostRun.id,
      });
      await this.cashLinks.link({
        tx,
        moneyTransactionId: postedMoneyTxId,
        accountingEntryId: entry.id,
        role: CashAccountingLinkRole.FEE,
      });

      await tx.statementLine.update({
        where: { id: line.id },
        data: {
          postedMode: StatementLinePostedMode.FEE_ENTRY_CREATED,
          feeVoidedAt: null,
          feeVoidReason: null,
        } as any,
      });

      return {
        mode,
        postingRunId: repostRun.id,
        version: repostRun.version,
        entryId: entry.id,
      };
    });
  }

  async postBatch(params: {
    legalEntityId: string;
    accountId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
    const where: any = {
      legalEntityId: params.legalEntityId,
      status: StatementLineStatus.MATCHED,
      postedAt: null,
    };
    if (params.accountId) where.accountId = params.accountId;
    if (params.from || params.to) {
      where.occurredAt = {};
      if (params.from) where.occurredAt.gte = params.from;
      if (params.to) where.occurredAt.lte = params.to;
    }

    const lines = await this.prisma.statementLine.findMany({
      where,
      select: { id: true },
      orderBy: [{ occurredAt: 'asc' }],
      take: limit,
    });

    let posted = 0;
    let failed = 0;
    for (const l of lines) {
      try {
        await this.postLine(l.id);
        posted += 1;
      } catch {
        failed += 1;
      }
    }

    return { processed: lines.length, posted, failed };
  }

  async splitLine(
    parentLineId: string,
    input: {
      splits: Array<{
        amount: string;
        description?: string;
        bankReference?: string;
        counterpartyName?: string;
      }>;
      forceSuggested?: boolean;
    },
  ) {
    const forceSuggested = input.forceSuggested ?? false;
    if (!input.splits || input.splits.length < 2) {
      throw new BadRequestException('splits must contain at least 2 parts');
    }

    return this.prisma.$transaction(async (tx) => {
      const parent = await tx.statementLine.findUnique({
        where: { id: parentLineId },
        include: {
          children: { select: { id: true, status: true } },
          statement: { select: { provider: true } },
        },
      });
      if (!parent) throw new NotFoundException('StatementLine not found');

      if (parent.status === StatementLineStatus.POSTED || parent.postedAt) {
        throw new ConflictException('Cannot split a POSTED line');
      }
      if (
        (parent as any).isSplitParent ||
        parent.status === (StatementLineStatus as any).SPLIT
      ) {
        throw new ConflictException('Line is already SPLIT');
      }
      if ((parent as any).children?.length) {
        throw new ConflictException('Line already has children');
      }
      if (
        parent.status !== StatementLineStatus.NEW &&
        parent.status !== StatementLineStatus.SUGGESTED &&
        parent.status !== StatementLineStatus.MATCHED &&
        parent.status !== StatementLineStatus.ERROR
      ) {
        throw new ConflictException('Line status does not allow split');
      }

      const parentAmount = new Prisma.Decimal(parent.amount as any);
      const sum = input.splits.reduce(
        (acc, s) => acc.add(new Prisma.Decimal(s.amount)),
        new Prisma.Decimal(0),
      );
      if (!sum.eq(parentAmount)) {
        throw new BadRequestException(
          'sum(splits.amount) must equal parent.amount',
        );
      }

      // Update parent: make it a container
      await tx.statementLine.update({
        where: { id: parent.id },
        data: {
          status: (StatementLineStatus as any).SPLIT,
          isSplitParent: true,
          matchedEntityType: null,
          matchedEntityId: null,
          postedMoneyTransactionId: null,
          postedAt: null,
          errorMessage: null,
        } as any,
      });

      const createdChildIds: string[] = [];
      for (let i = 0; i < input.splits.length; i++) {
        const part = input.splits[i];
        const amount = new Prisma.Decimal(part.amount);
        if (amount.lte(0))
          throw new BadRequestException('split.amount must be > 0');

        const amountBase = await this.currencyRates.convertToBase({
          amount,
          currency: parent.currency,
          date: parent.occurredAt,
        });

        const lineIndex = parent.lineIndex * 1000 + (i + 1); // avoids unique(statementId,lineIndex) conflict
        const lineHash = crypto
          .createHash('sha256')
          .update(
            [
              'split',
              parent.id,
              String(i + 1),
              parent.occurredAt.toISOString(),
              parent.direction,
              amount.toFixed(2),
              parent.currency,
            ].join('|'),
          )
          .digest('hex');

        const child = await tx.statementLine.create({
          data: {
            id: crypto.randomUUID(),
            statementId: parent.statementId,
            accountId: parent.accountId,
            legalEntityId: parent.legalEntityId,
            lineIndex,
            occurredAt: parent.occurredAt,
            direction: parent.direction,
            amount,
            currency: parent.currency,
            amountBase,
            description: part.description ?? parent.description ?? null,
            counterpartyName:
              part.counterpartyName ?? parent.counterpartyName ?? null,
            counterpartyInn: parent.counterpartyInn ?? null,
            bankReference: part.bankReference ?? parent.bankReference ?? null,
            externalLineId: null,
            lineHash,
            status: StatementLineStatus.NEW,
            parentLineId: parent.id,
            isSplitParent: false,
          } as any,
        });
        createdChildIds.push(child.id);
      }

      if (forceSuggested) {
        for (const id of createdChildIds) {
          await this.matcher.suggestForLine(id);
        }
      }

      return { parentLineId: parent.id, childrenIds: createdChildIds };
    });
  }

  async undoSplit(parentLineId: string) {
    return this.prisma.$transaction(async (tx) => {
      const parent = await tx.statementLine.findUnique({
        where: { id: parentLineId },
        include: { children: true },
      });
      if (!parent) throw new NotFoundException('StatementLine not found');

      if (
        !(parent as any).isSplitParent &&
        parent.status !== (StatementLineStatus as any).SPLIT
      ) {
        throw new ConflictException('Line is not a SPLIT parent');
      }
      const children = (parent as any).children ?? [];
      if (!children.length) {
        // no children -> just normalize parent flags
        const nextStatus = parent.suggestedMatch
          ? StatementLineStatus.SUGGESTED
          : StatementLineStatus.NEW;
        await tx.statementLine.update({
          where: { id: parent.id },
          data: { isSplitParent: false, status: nextStatus } as any,
        });
        return { parentLineId: parent.id, childrenDeleted: 0 };
      }

      const anyPosted = children.some(
        (c: any) => c.status === StatementLineStatus.POSTED || c.postedAt,
      );
      if (anyPosted) {
        throw new ConflictException(
          'Cannot undo split: some children are POSTED',
        );
      }

      const del = await tx.statementLine.deleteMany({
        where: { parentLineId: parent.id },
      });

      const nextStatus = parent.suggestedMatch
        ? StatementLineStatus.SUGGESTED
        : StatementLineStatus.NEW;
      await tx.statementLine.update({
        where: { id: parent.id },
        data: {
          status: nextStatus,
          isSplitParent: false,
          matchedEntityType: null,
          matchedEntityId: null,
          postedMoneyTransactionId: null,
          postedAt: null,
          errorMessage: null,
        } as any,
      });

      return { parentLineId: parent.id, childrenDeleted: del.count };
    });
  }
}
