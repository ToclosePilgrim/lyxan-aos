import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AccountingDocType,
  JournalRunStatus,
  Prisma,
  RecurringJournalStatus,
  RecurringJournalType,
} from '@prisma/client';
import crypto from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryService } from '../accounting-entry/accounting-entry.service';
import { getNextLineNumber } from '../accounting-entry/accounting-entry.utils';

function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}
function nextMonthStart(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
}
function ym(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

@Injectable()
export class RecurringJournalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingEntryService,
  ) {}

  async list(filter: {
    legalEntityId: string;
    status?: RecurringJournalStatus;
    journalType?: RecurringJournalType;
  }) {
    return this.prisma.recurringJournal.findMany({
      where: {
        legalEntityId: filter.legalEntityId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.journalType ? { journalType: filter.journalType } : {}),
      } as any,
      orderBy: [{ createdAt: 'desc' }],
      take: 1000,
    });
  }

  async create(dto: any) {
    return this.prisma.recurringJournal.create({
      data: {
        id: crypto.randomUUID(),
        legalEntityId: dto.legalEntityId,
        sourceDocumentId: dto.sourceDocumentId ?? null,
        journalType: dto.journalType,
        status: dto.status ?? RecurringJournalStatus.ACTIVE,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        frequency: dto.frequency ?? 'MONTHLY',
        dayOfMonth: dto.dayOfMonth ?? 1,
        amount: new Prisma.Decimal(dto.amount),
        currency: String(dto.currency).toUpperCase(),
        amountBase: new Prisma.Decimal(dto.amountBase),
        debitAccountId: dto.debitAccountId,
        creditAccountId: dto.creditAccountId,
        pnlCategoryId: dto.pnlCategoryId ?? null,
        cashflowCategoryId: dto.cashflowCategoryId ?? null,
      } as any,
    });
  }

  async patch(id: string, dto: any) {
    const existing = await this.prisma.recurringJournal.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('RecurringJournal not found');
    return this.prisma.recurringJournal.update({
      where: { id },
      data: {
        status: dto.status ?? undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate:
          dto.endDate === null
            ? null
            : dto.endDate
              ? new Date(dto.endDate)
              : undefined,
        dayOfMonth: dto.dayOfMonth ?? undefined,
        amount:
          dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,
        currency:
          dto.currency !== undefined
            ? String(dto.currency).toUpperCase()
            : undefined,
        amountBase:
          dto.amountBase !== undefined
            ? new Prisma.Decimal(dto.amountBase)
            : undefined,
        debitAccountId: dto.debitAccountId ?? undefined,
        creditAccountId: dto.creditAccountId ?? undefined,
        pnlCategoryId: dto.pnlCategoryId ?? undefined,
        cashflowCategoryId: dto.cashflowCategoryId ?? undefined,
      } as any,
    });
  }

  async archive(id: string) {
    const existing = await this.prisma.recurringJournal.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('RecurringJournal not found');
    return this.prisma.recurringJournal.update({
      where: { id },
      data: { status: RecurringJournalStatus.ARCHIVED },
    });
  }

  async listRuns(params: { journalId: string; from?: Date; to?: Date }) {
    const j = await this.prisma.recurringJournal.findUnique({
      where: { id: params.journalId },
    });
    if (!j) throw new NotFoundException('RecurringJournal not found');
    const where: any = { recurringJournalId: params.journalId };
    if (params.from || params.to) {
      where.periodStart = {};
      if (params.from) where.periodStart.gte = params.from;
      if (params.to) where.periodStart.lte = params.to;
    }
    return this.prisma.recurringJournalRun.findMany({
      where,
      orderBy: [{ periodStart: 'asc' }],
      take: 5000,
    });
  }

  async runBatch(input: {
    legalEntityId: string;
    from: Date;
    to: Date;
    journalType?: RecurringJournalType;
    limit?: number;
  }) {
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      to < from
    ) {
      throw new BadRequestException('Invalid from/to');
    }

    const journals = await this.prisma.recurringJournal.findMany({
      where: {
        legalEntityId: input.legalEntityId,
        status: RecurringJournalStatus.ACTIVE,
        ...(input.journalType ? { journalType: input.journalType } : {}),
      } as any,
      orderBy: [{ createdAt: 'asc' }],
      take: Math.min(input.limit ?? 200, 1000),
    });

    const results: any[] = [];
    const rangeStart = monthStart(from);
    const rangeEnd = monthStart(to);

    for (const j of journals) {
      let m = rangeStart;
      while (m <= rangeEnd) {
        const pStart = m;
        const pEnd = nextMonthStart(m);

        // within journal bounds
        const jStart = monthStart(new Date(j.startDate));
        const jEnd = j.endDate ? monthStart(new Date(j.endDate)) : null;
        if (pStart < jStart) {
          m = nextMonthStart(m);
          continue;
        }
        if (jEnd && pStart > jEnd) {
          m = nextMonthStart(m);
          continue;
        }

        const r = await this.prisma.$transaction(async (tx) => {
          // reserve run row (idempotency)
          try {
            const reserved = await tx.recurringJournalRun.create({
              data: {
                id: crypto.randomUUID(),
                recurringJournalId: j.id,
                periodStart: pStart,
                periodEnd: pEnd,
                runAt: new Date(),
                status: JournalRunStatus.ERROR, // will be updated to POSTED
                accountingEntryId: null,
                errorMessage: null,
              } as any,
            });

            const docId = j.sourceDocumentId ?? j.id;
            const postingDate = new Date(pEnd.getTime() - 1); // end of period
            const prefix =
              j.journalType === RecurringJournalType.PREPAID_RECOGNITION
                ? 'prepaid'
                : j.journalType === RecurringJournalType.DEPRECIATION
                  ? 'depr'
                  : 'amort';
            const docLineId = j.sourceDocumentId
              ? `${prefix}:${j.sourceDocumentId}:${ym(pStart)}`
              : `recurring:${j.id}:${ym(pStart)}`;

            const lineNumber = await getNextLineNumber(
              tx as any,
              AccountingDocType.FINANCIAL_DOCUMENT_RECOGNITION,
              docId,
            );

            const entry = await this.accounting.createEntry({
              tx,
              docType: AccountingDocType.FINANCIAL_DOCUMENT_RECOGNITION,
              docId,
              sourceDocType: j.sourceDocumentId
                ? AccountingDocType.FINANCIAL_DOCUMENT
                : undefined,
              sourceDocId: j.sourceDocumentId ?? undefined,
              legalEntityId: j.legalEntityId,
              lineNumber,
              postingDate,
              debitAccount: j.debitAccountId,
              creditAccount: j.creditAccountId,
              amount: j.amount as any,
              currency: j.currency,
              description: `Recurring journal ${j.journalType} for ${ym(pStart)}`,
              metadata: {
                docLineId,
                recurringJournalId: j.id,
                sourceDocumentId: j.sourceDocumentId ?? null,
                periodStart: pStart.toISOString(),
                periodEnd: pEnd.toISOString(),
                journalType: j.journalType,
              },
            });

            return await tx.recurringJournalRun.update({
              where: { id: reserved.id },
              data: {
                status: JournalRunStatus.POSTED,
                accountingEntryId: entry.id,
              } as any,
            });
          } catch (e: any) {
            if (e?.code === 'P2002') {
              // unique period already exists
              return {
                status: JournalRunStatus.SKIPPED,
                recurringJournalId: j.id,
                periodStart: pStart,
                periodEnd: pEnd,
              };
            }
            // If any other error, bubble up (transaction rolls back)
            throw e;
          }
        });

        results.push(r);
        m = nextMonthStart(m);
      }
    }

    return { journals: journals.length, resultsCount: results.length, results };
  }

  async upsertFromDocument(params: {
    tx: Prisma.TransactionClient;
    legalEntityId: string;
    sourceDocumentId: string;
    journalType: RecurringJournalType;
    startDate: Date;
    endDate?: Date | null;
    amount: Prisma.Decimal;
    currency: string;
    amountBase: Prisma.Decimal;
    debitAccountId: string;
    creditAccountId: string;
    pnlCategoryId?: string | null;
  }) {
    // Upsert by (legalEntityId, sourceDocumentId, journalType) via findFirst+update/create (no DB unique in spec)
    const existing = await params.tx.recurringJournal.findFirst({
      where: {
        legalEntityId: params.legalEntityId,
        sourceDocumentId: params.sourceDocumentId,
        journalType: params.journalType,
        status: { not: RecurringJournalStatus.ARCHIVED } as any,
      } as any,
      orderBy: [{ createdAt: 'desc' }],
    });

    const data: any = {
      legalEntityId: params.legalEntityId,
      sourceDocumentId: params.sourceDocumentId,
      journalType: params.journalType,
      status: RecurringJournalStatus.ACTIVE,
      startDate: params.startDate,
      endDate: params.endDate ?? null,
      frequency: 'MONTHLY',
      dayOfMonth: 1,
      amount: params.amount,
      currency: params.currency,
      amountBase: params.amountBase,
      debitAccountId: params.debitAccountId,
      creditAccountId: params.creditAccountId,
      pnlCategoryId: params.pnlCategoryId ?? null,
      cashflowCategoryId: null,
    };

    if (existing) {
      return params.tx.recurringJournal.update({
        where: { id: existing.id },
        data,
      });
    }
    return params.tx.recurringJournal.create({
      data: { id: crypto.randomUUID(), ...data },
    });
  }
}

