import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  Prisma,
  StatementLineStatus,
  StatementProvider,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

type CandidateType = 'PAYMENT_EXECUTION' | 'MONEY_TRANSACTION';

function norm(s?: string | null) {
  return (s ?? '').toString().trim().toLowerCase();
}

function containsNormalized(haystack?: string | null, needle?: string | null) {
  const h = norm(haystack);
  const n = norm(needle);
  if (!h || !n) return false;
  return h.includes(n);
}

function diffDays(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / 86_400_000);
}

@Injectable()
export class StatementMatchingService {
  constructor(private readonly prisma: PrismaService) {}

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

  private scoreAmount(
    diff: Prisma.Decimal,
    tolerance: Prisma.Decimal,
    reasons: string[],
  ): number {
    if (diff.eq(0)) {
      reasons.push('amount_exact');
      return 50;
    }
    if (diff.lte(tolerance)) {
      reasons.push('amount_tol');
      return 40;
    }
    return 0;
  }

  private scoreDate(days: number, reasons: string[]): number {
    if (days === 0) {
      reasons.push('date_0d');
      return 25;
    }
    if (days === 1) {
      reasons.push('date_1d');
      return 20;
    }
    if (days === 2 || days === 3) {
      reasons.push('date_2_3d');
      return 15;
    }
    if (days === 4 || days === 5) {
      reasons.push('date_4_5d');
      return 8;
    }
    return 0;
  }

  private scoreReference(
    lineRef?: string | null,
    candidateRef?: string | null,
    candidateDesc?: string | null,
    reasons?: string[],
  ): number {
    const r = reasons ?? [];
    const ref = (lineRef ?? '').trim();
    if (!ref) return 0;
    if (
      containsNormalized(candidateRef, ref) ||
      containsNormalized(ref, candidateRef)
    ) {
      r.push('bank_ref_match');
      return 20;
    }
    if (containsNormalized(candidateDesc, ref)) {
      r.push('bank_ref_in_desc');
      return 20;
    }
    return 0;
  }

  private scoreTextHint(
    counterpartyName?: string | null,
    candidateDesc?: string | null,
    reasons?: string[],
  ): number {
    const r = reasons ?? [];
    if (containsNormalized(candidateDesc, counterpartyName)) {
      r.push('counterparty_hint');
      return 5;
    }
    return 0;
  }

  private finalizeCandidate(params: {
    entityType: CandidateType;
    entityId: string;
    score: number;
    reasons: string[];
    preview: Record<string, unknown>;
  }) {
    return {
      entityType: params.entityType,
      entityId: params.entityId,
      score: params.score,
      reasons: params.reasons,
      preview: params.preview,
    };
  }

  async suggestForLine(lineId: string) {
    const line = await this.prisma.statementLine.findUnique({
      where: { id: lineId },
      include: { statement: { select: { provider: true } } },
    });
    if (!line) throw new NotFoundException('StatementLine not found');

    if (
      line.status !== StatementLineStatus.NEW &&
      line.status !== StatementLineStatus.ERROR
    ) {
      return { lineId: line.id, status: line.status, skipped: true };
    }

    const provider = (line as any).statement?.provider as
      | StatementProvider
      | undefined;
    const windowDays = this.getDateWindowDays(
      provider ?? StatementProvider.BANK,
    );
    const windowFrom = new Date(line.occurredAt);
    windowFrom.setUTCDate(windowFrom.getUTCDate() - windowDays);
    const windowTo = new Date(line.occurredAt);
    windowTo.setUTCDate(windowTo.getUTCDate() + windowDays);

    const amount = new Prisma.Decimal(line.amount as any);
    const tolerance = this.getTolerance(amount);
    const lower = amount.sub(tolerance);
    const upper = amount.add(tolerance);

    const candidates: Array<
      ReturnType<StatementMatchingService['finalizeCandidate']>
    > = [];

    // 1) PaymentExecution candidates (primarily OUT)
    if (line.direction === MoneyTransactionDirection.OUT) {
      const executions = await this.prisma.paymentExecution.findMany({
        where: {
          legalEntityId: line.legalEntityId,
          fromAccountId: line.accountId,
          currency: line.currency,
          executedAt: { gte: windowFrom, lte: windowTo },
          amount: { gte: lower, lte: upper },
        } as any,
        orderBy: [{ executedAt: 'desc' }],
        take: 50,
      });

      for (const e of executions as any[]) {
        const reasons: string[] = [];
        const diff = new Prisma.Decimal(e.amount).sub(amount).abs();
        const aScore = this.scoreAmount(diff, tolerance, reasons);
        if (aScore === 0) continue;

        const dDays = diffDays(
          new Date(line.occurredAt),
          new Date(e.executedAt),
        );
        if (dDays > windowDays) continue;
        const dScore = this.scoreDate(dDays, reasons);
        if (dScore === 0 && dDays > 5) continue;

        const rScore = this.scoreReference(
          line.bankReference,
          e.bankReference,
          e.description,
          reasons,
        );
        const tScore = this.scoreTextHint(
          line.counterpartyName,
          e.description,
          reasons,
        );
        // Preference: for OUT lines we want PaymentExecution to be the primary entity to match against.
        const prefer = 3;
        reasons.push('prefer_payment_execution');
        const score = aScore + dScore + rScore + tScore + prefer;
        if (score < 50) continue;

        candidates.push(
          this.finalizeCandidate({
            entityType: 'PAYMENT_EXECUTION',
            entityId: e.id,
            score,
            reasons,
            preview: {
              executedAt: new Date(e.executedAt).toISOString(),
              amount: String(e.amount),
              currency: e.currency,
              bankReference: e.bankReference,
              description: e.description,
            },
          }),
        );
      }
    }

    // 2) MoneyTransaction candidates (fallback)
    const moneyTx = await this.prisma.moneyTransaction.findMany({
      where: {
        accountId: line.accountId,
        currency: line.currency,
        direction: line.direction,
        occurredAt: { gte: windowFrom, lte: windowTo },
        amount: { gte: lower, lte: upper },
        status: 'POSTED' as any,
      } as any,
      orderBy: [{ occurredAt: 'desc' }],
      take: 50,
    });

    for (const t of moneyTx as any[]) {
      // For OUT lines, we prefer PAYMENT_EXECUTION; still allow money tx suggestions.
      // For IN lines, MoneyTransaction is primary.
      const reasons: string[] = [];
      const diff = new Prisma.Decimal(t.amount).sub(amount).abs();
      const aScore = this.scoreAmount(diff, tolerance, reasons);
      if (aScore === 0) continue;

      const dDays = diffDays(new Date(line.occurredAt), new Date(t.occurredAt));
      if (dDays > windowDays) continue;
      const dScore = this.scoreDate(dDays, reasons);
      if (dScore === 0 && dDays > 5) continue;

      // MoneyTransaction doesn't have bankReference; use statement ref as hint in description
      const rScore = this.scoreReference(
        line.bankReference,
        null,
        t.description,
        reasons,
      );
      const tScore = this.scoreTextHint(
        line.counterpartyName,
        t.description,
        reasons,
      );
      const score = aScore + dScore + rScore + tScore;

      // Small boost if money tx was created from PAYMENT_EXECUTION (helps ordering)
      if (t.sourceType === MoneyTransactionSourceType.PAYMENT_EXECUTION) {
        reasons.push('source_payment_execution');
      }

      if (score < 50) continue;

      candidates.push(
        this.finalizeCandidate({
          entityType: 'MONEY_TRANSACTION',
          entityId: t.id,
          score,
          reasons,
          preview: {
            occurredAt: new Date(t.occurredAt).toISOString(),
            amount: String(t.amount),
            currency: t.currency,
            sourceType: t.sourceType,
            sourceId: t.sourceId,
          },
        }),
      );
    }

    candidates.sort((a, b) => b.score - a.score);
    const top = candidates.slice(0, 3);

    const suggestedMatch = {
      generatedAt: new Date().toISOString(),
      strategyVersion: '4.2.0',
      candidates: top,
    };

    const nextStatus =
      top.length > 0 ? StatementLineStatus.SUGGESTED : StatementLineStatus.NEW;

    const updated = await this.prisma.statementLine.update({
      where: { id: line.id },
      data: {
        suggestedMatch: suggestedMatch as any,
        status: nextStatus,
        errorMessage: null,
      } as any,
    });

    return { lineId: updated.id, status: updated.status, suggestedMatch };
  }

  async suggestBatch(params: {
    legalEntityId: string;
    accountId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }) {
    if (!params.legalEntityId) {
      throw new BadRequestException('legalEntityId is required');
    }
    const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);

    const where: any = {
      legalEntityId: params.legalEntityId,
      status: StatementLineStatus.NEW,
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
      orderBy: [{ occurredAt: 'desc' }],
      take: limit,
    });

    let suggested = 0;
    let unchanged = 0;
    for (const l of lines) {
      const res = await this.suggestForLine(l.id);
      if (res.status === StatementLineStatus.SUGGESTED) suggested += 1;
      else unchanged += 1;
    }

    return { processed: lines.length, suggested, unchanged };
  }
}
