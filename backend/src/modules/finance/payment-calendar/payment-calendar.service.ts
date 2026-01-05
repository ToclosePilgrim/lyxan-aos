import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PaymentPlanStatus,
  PaymentRequestStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

function dateKeyUtc(d: Date): string {
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
}

@Injectable()
export class PaymentCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getCalendar(params: {
    legalEntityId: string;
    from: Date;
    to: Date;
    currency?: string;
    includeBacklog?: boolean;
  }) {
    if (!params.legalEntityId) {
      throw new BadRequestException('legalEntityId is required');
    }
    const from = new Date(params.from);
    const to = new Date(params.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('from/to are invalid');
    }
    if (from > to) throw new BadRequestException('from must be <= to');

    const currency = params.currency
      ? params.currency.toUpperCase()
      : undefined;

    const items = await this.prisma.paymentPlan.findMany({
      where: {
        legalEntityId: params.legalEntityId,
        status: PaymentPlanStatus.PLANNED,
        plannedDate: { gte: from, lte: to },
        currency: currency ?? undefined,
      } as any,
      orderBy: [{ plannedDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        fromAccount: true,
        paymentRequest: {
          select: {
            id: true,
            type: true,
            priority: true,
            counterpartyId: true,
            cashflowCategoryId: true,
            status: true,
          },
        },
      },
    });

    // Aggregate days
    const byDay = new Map<
      string,
      {
        date: string;
        plannedOutBase: Prisma.Decimal;
        plannedOutByCurrency: Record<string, Prisma.Decimal>;
        count: number;
      }
    >();

    for (const p of items as any[]) {
      const key = dateKeyUtc(p.plannedDate);
      const cur = (p.currency ?? '').toUpperCase();
      const base = new Prisma.Decimal(p.plannedAmountBase);
      const bucket = byDay.get(key) ?? {
        date: key,
        plannedOutBase: new Prisma.Decimal(0),
        plannedOutByCurrency: {},
        count: 0,
      };
      bucket.plannedOutBase = bucket.plannedOutBase.add(base);
      bucket.plannedOutByCurrency[cur] = new Prisma.Decimal(
        bucket.plannedOutByCurrency[cur] ?? 0,
      ).add(new Prisma.Decimal(p.plannedAmount));
      bucket.count += 1;
      byDay.set(key, bucket);
    }

    const days = Array.from(byDay.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    let backlog: any[] = [];
    if (params.includeBacklog) {
      const requests = await this.prisma.paymentRequest.findMany({
        where: {
          legalEntityId: params.legalEntityId,
          status: PaymentRequestStatus.APPROVED,
          currency: currency ?? undefined,
        } as any,
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          type: true,
          priority: true,
          counterpartyId: true,
          cashflowCategoryId: true,
          status: true,
          amount: true,
          currency: true,
          plannedPayDate: true,
        },
      });

      // For MVP, compute planned sum per request with a group-by like aggregate in a loop (small volumes).
      for (const r of requests as any[]) {
        const agg = await this.prisma.paymentPlan.aggregate({
          where: {
            paymentRequestId: r.id,
            status: PaymentPlanStatus.PLANNED,
          },
          _sum: { plannedAmount: true },
        });
        const planned = agg._sum.plannedAmount ?? new Prisma.Decimal(0);
        const reqAmount = new Prisma.Decimal(r.amount);
        if (planned.lt(reqAmount)) {
          backlog.push({
            ...r,
            plannedAmount: planned,
            remainingAmount: reqAmount.sub(planned),
          });
        }
      }
    }

    // Serialize decimals for JSON
    const daysOut = days.map((d) => ({
      date: d.date,
      plannedOutBase: d.plannedOutBase.toString(),
      plannedOutByCurrency: Object.fromEntries(
        Object.entries(d.plannedOutByCurrency).map(([k, v]) => [
          k,
          v.toString(),
        ]),
      ),
      count: d.count,
    }));

    const itemsOut = (items as any[]).map((p) => ({
      ...p,
      plannedAmount: String(p.plannedAmount),
      plannedAmountBase: String(p.plannedAmountBase),
    }));

    backlog = backlog.map((b) => ({
      ...b,
      amount: String(b.amount),
      plannedAmount: String(b.plannedAmount),
      remainingAmount: String(b.remainingAmount),
    }));

    return { days: daysOut, items: itemsOut, backlog };
  }
}

