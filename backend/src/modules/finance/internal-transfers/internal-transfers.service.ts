import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingDocType,
  CashAccountingLinkRole,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  MoneyTransactionStatus,
  Prisma,
  StatementLineStatus,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryService } from '../accounting-entry/accounting-entry.service';
import { CashAccountingLinksService } from '../cash-accounting-links/cash-accounting-links.service';
import { ACCOUNTING_ACCOUNTS } from '../accounting-accounts.config';
import { getNextLineNumber } from '../accounting-entry/accounting-entry.utils';
import { PostingRunsService } from '../posting-runs/posting-runs.service';

@Injectable()
export class InternalTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingEntries: AccountingEntryService,
    private readonly cashLinks: CashAccountingLinksService,
    private readonly postingRuns: PostingRunsService,
  ) {}

  async postInternalTransfer(input: {
    outMoneyTransactionId: string;
    inMoneyTransactionId: string;
  }) {
    const outTx = await this.prisma.moneyTransaction.findUnique({
      where: { id: input.outMoneyTransactionId },
      include: {
        account: { select: { id: true, legalEntityId: true, currency: true } },
      },
    });
    const inTx = await this.prisma.moneyTransaction.findUnique({
      where: { id: input.inMoneyTransactionId },
      include: {
        account: { select: { id: true, legalEntityId: true, currency: true } },
      },
    });

    if (!outTx) throw new NotFoundException('outMoneyTransaction not found');
    if (!inTx) throw new NotFoundException('inMoneyTransaction not found');

    if (outTx.sourceType !== MoneyTransactionSourceType.INTERNAL_TRANSFER) {
      throw new BadRequestException(
        'outMoneyTransaction sourceType must be INTERNAL_TRANSFER',
      );
    }
    if (inTx.sourceType !== MoneyTransactionSourceType.INTERNAL_TRANSFER) {
      throw new BadRequestException(
        'inMoneyTransaction sourceType must be INTERNAL_TRANSFER',
      );
    }
    if (!outTx.sourceId || !inTx.sourceId || outTx.sourceId !== inTx.sourceId) {
      throw new BadRequestException(
        'INTERNAL_TRANSFER transactions must share the same sourceId',
      );
    }
    if (outTx.direction !== MoneyTransactionDirection.OUT) {
      throw new BadRequestException(
        'outMoneyTransaction direction must be OUT',
      );
    }
    if (inTx.direction !== MoneyTransactionDirection.IN) {
      throw new BadRequestException('inMoneyTransaction direction must be IN');
    }
    if (outTx.currency.toUpperCase() !== inTx.currency.toUpperCase()) {
      throw new BadRequestException(
        'Transfer legs must have the same currency',
      );
    }
    if (outTx.account.legalEntityId !== inTx.account.legalEntityId) {
      throw new BadRequestException(
        'Transfer legs must belong to the same legalEntity',
      );
    }

    const transferGroupId = outTx.sourceId;
    const legalEntityId = outTx.account.legalEntityId;
    const currency = outTx.currency;
    const amount = new Prisma.Decimal(outTx.amount);

    // MVP posting: two lines via clearing account to avoid Dr=Cr same account constraint.
    // Line 1 (out): Dr clearing / Cr cash equivalents
    // Line 2 (in):  Dr cash equivalents / Cr clearing
    const postingDate = new Date(outTx.occurredAt);

    return this.prisma.$transaction(async (tx) => {
      const run = await this.postingRuns.getOrCreatePostedRun({
        tx,
        legalEntityId,
        docType: AccountingDocType.INTERNAL_TRANSFER,
        docId: transferGroupId,
      });
      const baseLineNo = await getNextLineNumber(
        tx,
        AccountingDocType.INTERNAL_TRANSFER,
        transferGroupId,
      );
      const line1No = baseLineNo;
      const line2No = baseLineNo + 1;

      const outEntry = await this.accountingEntries.createEntry({
        tx,
        docType: AccountingDocType.INTERNAL_TRANSFER,
        docId: transferGroupId,
        sourceDocType: AccountingDocType.INTERNAL_TRANSFER,
        sourceDocId: transferGroupId,
        legalEntityId,
        lineNumber: line1No,
        postingDate,
        debitAccount: ACCOUNTING_ACCOUNTS.CASH_TRANSFER_CLEARING,
        creditAccount: ACCOUNTING_ACCOUNTS.CASH_EQUIVALENTS,
        amount,
        currency,
        description: `Internal transfer (out) ${transferGroupId}`,
        metadata: {
          docLineId: `internal_transfer:${transferGroupId}:out:run:${run.id}`,
          transferGroupId,
          fromAccountId: outTx.accountId,
          toAccountId: inTx.accountId,
          outMoneyTransactionId: outTx.id,
          inMoneyTransactionId: inTx.id,
        },
        postingRunId: run.id,
      });

      const inEntry = await this.accountingEntries.createEntry({
        tx,
        docType: AccountingDocType.INTERNAL_TRANSFER,
        docId: transferGroupId,
        sourceDocType: AccountingDocType.INTERNAL_TRANSFER,
        sourceDocId: transferGroupId,
        legalEntityId,
        lineNumber: line2No,
        postingDate,
        debitAccount: ACCOUNTING_ACCOUNTS.CASH_EQUIVALENTS,
        creditAccount: ACCOUNTING_ACCOUNTS.CASH_TRANSFER_CLEARING,
        amount,
        currency,
        description: `Internal transfer (in) ${transferGroupId}`,
        metadata: {
          docLineId: `internal_transfer:${transferGroupId}:in:run:${run.id}`,
          transferGroupId,
          fromAccountId: outTx.accountId,
          toAccountId: inTx.accountId,
          outMoneyTransactionId: outTx.id,
          inMoneyTransactionId: inTx.id,
        },
        postingRunId: run.id,
      });

      const outLink = await this.cashLinks.link({
        tx,
        moneyTransactionId: outTx.id,
        accountingEntryId: outEntry.id,
        role: CashAccountingLinkRole.TRANSFER,
      });
      const inLink = await this.cashLinks.link({
        tx,
        moneyTransactionId: inTx.id,
        accountingEntryId: inEntry.id,
        role: CashAccountingLinkRole.TRANSFER,
      });

      return {
        transferGroupId,
        accountingEntryIds: [outEntry.id, inEntry.id],
        cashLinkIds: [outLink.id, inLink.id],
        postingRunId: run.id,
      };
    });
  }

  async voidInternalTransfer(input: {
    transferGroupId: string;
    reason: string;
  }) {
    const reason = (input.reason ?? '').trim() || 'void';

    const legs = await this.prisma.moneyTransaction.findMany({
      where: {
        sourceType: MoneyTransactionSourceType.INTERNAL_TRANSFER,
        sourceId: input.transferGroupId,
      } as any,
      select: {
        id: true,
        status: true,
        account: { select: { legalEntityId: true } },
      } as any,
    });
    if (!legs.length)
      throw new NotFoundException('Internal transfer group not found');
    const legalEntityId = (legs as any)[0]?.account?.legalEntityId as string;

    const anyPosted = legs.some(
      (l: any) => l.status === MoneyTransactionStatus.POSTED,
    );
    if (!anyPosted)
      return { alreadyVoided: true, transferGroupId: input.transferGroupId };

    const reconciled = await (this.prisma as any).statementLine.findFirst({
      where: {
        postedMoneyTransactionId: { in: legs.map((l: any) => l.id) },
        status: StatementLineStatus.POSTED,
      } as any,
      select: { id: true },
    });
    if (reconciled) {
      throw new ConflictException(
        'reconciled cash cannot be voided; create adjustment instead',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.moneyTransaction.updateMany({
        where: { id: { in: legs.map((l: any) => l.id) } } as any,
        data: {
          status: MoneyTransactionStatus.VOIDED,
          voidedAt: new Date(),
          voidReason: reason,
        } as any,
      });

      const run = await this.postingRuns.getActivePostedRun({
        tx,
        legalEntityId,
        docType: AccountingDocType.INTERNAL_TRANSFER,
        docId: input.transferGroupId,
      } as any);
      if (run) {
        await this.postingRuns.voidRun({ tx, runId: run.id, reason });
      }

      return {
        voided: true,
        transferGroupId: input.transferGroupId,
        postingRunId: run?.id ?? null,
      };
    });
  }
}
