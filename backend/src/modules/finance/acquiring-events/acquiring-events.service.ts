import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AcquiringEventStatus,
  AccountingDocType,
  PostingRunStatus,
  Prisma,
  StatementLineStatus,
} from '@prisma/client';
import crypto from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import { CurrencyRateService } from '../currency-rates/currency-rate.service';

@Injectable()
export class AcquiringEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: CurrencyRateService,
  ) {}

  async import(params: {
    legalEntityId: string;
    provider: string;
    raw?: any;
    events: Array<{
      eventType: any;
      occurredAt: Date;
      amount: string;
      currency: string;
      externalRef: string;
      orderId?: string | null;
    }>;
  }) {
    const provider = (params.provider ?? '').trim().toUpperCase();
    if (!provider) throw new BadRequestException('provider is required');
    if (!params.legalEntityId)
      throw new BadRequestException('legalEntityId is required');
    if (!params.events?.length)
      throw new BadRequestException('events is required');

    return this.prisma.$transaction(async (tx) => {
      let created = 0;
      let skipped = 0;

      for (const e of params.events) {
        const occurredAt = new Date(e.occurredAt);
        const amount = new Prisma.Decimal(e.amount);
        const currency = (e.currency ?? '').toUpperCase();
        if (!currency || currency.length !== 3) {
          throw new BadRequestException('currency must be 3-letter code');
        }
        const amountBase = await this.rates.convertToBase({
          amount,
          currency,
          date: occurredAt,
        });

        const existing = await tx.acquiringEvent.findUnique({
          where: {
            legalEntityId_provider_externalRef_eventType: {
              legalEntityId: params.legalEntityId,
              provider,
              externalRef: e.externalRef,
              eventType: e.eventType,
            },
          } as any,
          select: { id: true },
        });
        if (existing) {
          skipped += 1;
          continue;
        }

        await tx.acquiringEvent.create({
          data: {
            id: crypto.randomUUID(),
            legalEntityId: params.legalEntityId,
            provider,
            eventType: e.eventType,
            occurredAt,
            amount,
            currency,
            amountBase,
            externalRef: e.externalRef,
            orderId: e.orderId ?? null,
            status: AcquiringEventStatus.IMPORTED,
            raw: params.raw ?? undefined,
          } as any,
        });
        created += 1;
      }

      return { created, skipped };
    });
  }

  async list(params: {
    legalEntityId: string;
    provider?: string;
    status?: string;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.AcquiringEventWhereInput = {
      legalEntityId: params.legalEntityId,
    } as any;
    if (params.provider)
      (where as any).provider = params.provider.trim().toUpperCase();
    if (params.status) (where as any).status = params.status as any;
    if (params.from || params.to) {
      (where as any).occurredAt = {};
      if (params.from) (where as any).occurredAt.gte = params.from;
      if (params.to) (where as any).occurredAt.lte = params.to;
    }

    const events = await this.prisma.acquiringEvent.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });

    // Attach PostingRun info (latest run per event) for UI/audit.
    const ids = events.map((e) => e.id);
    if (!ids.length) return events as any;

    const runs = await (this.prisma as any).accountingPostingRun.findMany({
      where: {
        legalEntityId: params.legalEntityId,
        docType: AccountingDocType.ACQUIRING_EVENT,
        docId: { in: ids },
      } as any,
      orderBy: [{ docId: 'asc' }, { version: 'desc' }],
      select: { id: true, docId: true, status: true },
    });

    const latestByDocId = new Map<
      string,
      { id: string; status: PostingRunStatus }
    >();
    for (const r of runs) {
      if (!latestByDocId.has(r.docId))
        latestByDocId.set(r.docId, { id: r.id, status: r.status });
    }

    return events.map((e) => {
      const run = latestByDocId.get(e.id);
      return {
        ...e,
        postingRunId: run?.id ?? null,
        postingRunStatus: run?.status ?? null,
      };
    }) as any;
  }

  async linkStatementLine(eventId: string, statementLineId: string) {
    return this.prisma.$transaction(async (tx) => {
      const ev = await tx.acquiringEvent.findUnique({ where: { id: eventId } });
      if (!ev) throw new NotFoundException('AcquiringEvent not found');

      const line = await tx.statementLine.findUnique({
        where: { id: statementLineId },
        select: { id: true, legalEntityId: true, status: true, postedAt: true },
      });
      if (!line) throw new NotFoundException('StatementLine not found');
      if (line.legalEntityId !== ev.legalEntityId) {
        throw new BadRequestException('legalEntity mismatch');
      }
      if (line.status === StatementLineStatus.IGNORED) {
        throw new BadRequestException('Cannot link to IGNORED statement line');
      }

      return tx.acquiringEvent.update({
        where: { id: ev.id },
        data: { statementLineId: line.id } as any,
      });
    });
  }
}
