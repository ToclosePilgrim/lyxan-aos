import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingDocType,
  AcquiringAccountingLinkRole,
  AcquiringEventStatus,
  AcquiringEventType,
  Prisma,
} from '@prisma/client';
import crypto from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryService } from '../accounting-entry/accounting-entry.service';
import { ACCOUNTING_ACCOUNTS } from '../accounting-accounts.config';
import { PostingRunsService } from '../posting-runs/posting-runs.service';

@Injectable()
export class AcquiringPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingEntryService,
    private readonly postingRuns: PostingRunsService,
  ) {}

  async postEvent(eventId: string) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.acquiringEvent.findUnique({
        where: { id: eventId },
      });
      if (!event) throw new NotFoundException('AcquiringEvent not found');
      if (event.status === AcquiringEventStatus.IGNORED) {
        throw new BadRequestException('Event is IGNORED');
      }

      const docType = AccountingDocType.ACQUIRING_EVENT;
      const docId = event.id;
      const postingDate = event.occurredAt;

      const run = await this.postingRuns.getOrCreatePostedRun({
        tx,
        legalEntityId: event.legalEntityId,
        docType,
        docId,
      });

      // Idempotent: if the run already has entries, return them (truth = PostingRun).
      const existingEntries = await tx.accountingEntry.findMany({
        where: { postingRunId: run.id } as any,
        orderBy: [{ lineNumber: 'asc' }],
      });
      if (existingEntries.length) {
        if (event.status !== AcquiringEventStatus.POSTED) {
          await tx.acquiringEvent.update({
            where: { id: event.id },
            data: { status: AcquiringEventStatus.POSTED } as any,
          });
        }
        return {
          eventId: event.id,
          status: 'POSTED',
          postingRunId: run.id,
          entries: existingEntries,
        };
      }

      const amount = new Prisma.Decimal(event.amount as any);
      if (amount.lte(0)) throw new BadRequestException('amount must be > 0');

      const baseMeta = {
        docLineId: '',
        acquiring: {
          provider: (event.provider ?? '').toString().trim().toUpperCase(),
          eventType: event.eventType,
          externalRef: event.externalRef,
          orderId: event.orderId ?? null,
          statementLineId: event.statementLineId ?? null,
        },
      } as any;

      const createLinkedEntry = async (params: {
        role: AcquiringAccountingLinkRole;
        docLineId: string;
        debitAccount: string;
        creditAccount: string;
        description: string;
      }) => {
        const entry = await this.accounting.createEntry({
          tx,
          docType,
          docId,
          legalEntityId: event.legalEntityId,
          lineNumber: 1,
          postingDate,
          debitAccount: params.debitAccount,
          creditAccount: params.creditAccount,
          amount,
          currency: event.currency,
          description: params.description,
          metadata: { ...baseMeta, docLineId: params.docLineId },
          postingRunId: run.id,
        });

        await tx.acquiringAccountingLink.upsert({
          where: {
            acquiringEventId_accountingEntryId_role: {
              acquiringEventId: event.id,
              accountingEntryId: entry.id,
              role: params.role,
            },
          } as any,
          update: {},
          create: {
            id: crypto.randomUUID(),
            acquiringEventId: event.id,
            accountingEntryId: entry.id,
            role: params.role,
          } as any,
        });

        return entry;
      };

      let entry: any;
      if (event.eventType === AcquiringEventType.PAYMENT_CAPTURED) {
        entry = await createLinkedEntry({
          role: AcquiringAccountingLinkRole.PRINCIPAL,
          docLineId: `acquiring_event:${event.id}:principal`,
          debitAccount: ACCOUNTING_ACCOUNTS.CLEARING_ACQUIRING,
          creditAccount: ACCOUNTING_ACCOUNTS.CLEARING_ACQUIRING_SALES,
          description: `Acquiring captured ${event.provider} ${event.externalRef}`,
        });
      } else if (event.eventType === AcquiringEventType.SETTLEMENT) {
        entry = await createLinkedEntry({
          role: AcquiringAccountingLinkRole.SETTLEMENT,
          docLineId: `acquiring_event:${event.id}:settlement`,
          debitAccount: ACCOUNTING_ACCOUNTS.CASH_EQUIVALENTS,
          creditAccount: ACCOUNTING_ACCOUNTS.CLEARING_ACQUIRING,
          description: `Acquiring settlement ${event.provider} ${event.externalRef}`,
        });
      } else if (event.eventType === AcquiringEventType.FEE_CHARGED) {
        entry = await createLinkedEntry({
          role: AcquiringAccountingLinkRole.FEE,
          docLineId: `acquiring_event:${event.id}:fee`,
          debitAccount: ACCOUNTING_ACCOUNTS.ACQUIRING_FEES_EXPENSE,
          creditAccount: ACCOUNTING_ACCOUNTS.CLEARING_ACQUIRING,
          description: `Acquiring fee ${event.provider} ${event.externalRef}`,
        });
      } else if (event.eventType === AcquiringEventType.PAYMENT_REFUNDED) {
        entry = await createLinkedEntry({
          role: AcquiringAccountingLinkRole.REFUND,
          docLineId: `acquiring_event:${event.id}:refund`,
          debitAccount: ACCOUNTING_ACCOUNTS.CLEARING_ACQUIRING_SALES,
          creditAccount: ACCOUNTING_ACCOUNTS.CLEARING_ACQUIRING,
          description: `Acquiring refund ${event.provider} ${event.externalRef}`,
        });
      } else {
        throw new BadRequestException('Unsupported eventType');
      }

      if (event.status !== AcquiringEventStatus.POSTED) {
        await tx.acquiringEvent.update({
          where: { id: event.id },
          data: { status: AcquiringEventStatus.POSTED } as any,
        });
      }

      const entries = await tx.accountingEntry.findMany({
        where: { postingRunId: run.id } as any,
        orderBy: [{ lineNumber: 'asc' }],
      });
      return {
        eventId: event.id,
        status: 'POSTED',
        postingRunId: run.id,
        entryId: entry.id,
        entries,
      };
    });
  }

  async voidEvent(eventId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.acquiringEvent.findUnique({
        where: { id: eventId },
      });
      if (!event) throw new NotFoundException('AcquiringEvent not found');

      if (event.statementLineId) {
        const line = await tx.statementLine.findUnique({
          where: { id: event.statementLineId },
          select: { id: true, status: true, postedMoneyTransactionId: true },
        });
        // MVP safety rule: if a linked statement line is POSTED with a moneyTx, don't allow voiding.
        if (
          line &&
          (line as any).status === 'POSTED' &&
          (line as any).postedMoneyTransactionId
        ) {
          throw new ConflictException(
            'Cannot void acquiring event: linked statement line is POSTED',
          );
        }
      }

      // Idempotency: if already voided (original run is VOIDED and points to reversalRunId), return it.
      const voidedOriginal = await (tx as any).accountingPostingRun.findFirst({
        where: {
          legalEntityId: event.legalEntityId,
          docType: AccountingDocType.ACQUIRING_EVENT,
          docId: event.id,
          status: 'VOIDED',
          reversalRunId: { not: null },
        } as any,
        orderBy: [{ version: 'desc' }],
        select: { id: true, reversalRunId: true },
      });
      if (voidedOriginal?.reversalRunId) {
        return {
          eventId: event.id,
          originalRunId: voidedOriginal.id,
          reversalRunId: voidedOriginal.reversalRunId,
          alreadyVoided: true,
        };
      }

      // Find the active POSTED run to void, excluding reversal runs (those referenced by a VOIDED original).
      const reversalIds = await (tx as any).accountingPostingRun.findMany({
        where: {
          legalEntityId: event.legalEntityId,
          docType: AccountingDocType.ACQUIRING_EVENT,
          docId: event.id,
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
          legalEntityId: event.legalEntityId,
          docType: AccountingDocType.ACQUIRING_EVENT,
          docId: event.id,
          status: 'POSTED',
          ...(reversalRunIds.length ? { id: { notIn: reversalRunIds } } : {}),
        } as any,
        orderBy: [{ version: 'desc' }],
      });
      if (!run)
        throw new ConflictException(
          'No active PostingRun found for acquiring event',
        );

      const res = await this.postingRuns.voidRun({
        tx,
        runId: run.id,
        reason,
      });

      return {
        eventId: event.id,
        originalRunId: run.id,
        reversalRunId: res.reversalRun?.id ?? null,
        alreadyVoided: (res as any).alreadyVoided ?? false,
      };
    });
  }

  async postBatch(params: {
    legalEntityId: string;
    provider?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
    const where: any = {
      legalEntityId: params.legalEntityId,
      status: AcquiringEventStatus.IMPORTED,
    };
    if (params.provider) where.provider = params.provider;
    if (params.from || params.to) {
      where.occurredAt = {};
      if (params.from) where.occurredAt.gte = params.from;
      if (params.to) where.occurredAt.lte = params.to;
    }

    const ids = await this.prisma.acquiringEvent.findMany({
      where,
      select: { id: true },
      orderBy: [{ occurredAt: 'asc' }],
      take: limit,
    });

    let posted = 0;
    let failed = 0;
    for (const e of ids) {
      try {
        await this.postEvent(e.id);
        posted += 1;
      } catch {
        failed += 1;
      }
    }
    return { processed: ids.length, posted, failed };
  }
}
