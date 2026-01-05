import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingDocType,
  CashAccountingLinkRole,
  Prisma,
  StatementLineStatus,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { StatementMatchingService } from './statement-matching.service';
import { StatementsPostingService } from './statements-posting.service';

type QueueType =
  | 'NEW'
  | 'SUGGESTED'
  | 'MATCHED'
  | 'ERROR'
  | 'UNEXPLAINED_CASH'
  | 'POSTED_MISSING_LINKS';

@Injectable()
export class ReconciliationControlsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matcher: StatementMatchingService,
    private readonly posting: StatementsPostingService,
  ) {}

  private buildLineWhere(filters: {
    legalEntityId: string;
    accountId?: string;
    from?: Date;
    to?: Date;
  }): Prisma.StatementLineWhereInput {
    if (!filters.legalEntityId)
      throw new BadRequestException('legalEntityId is required');
    const where: any = { legalEntityId: filters.legalEntityId };
    if (filters.accountId) where.accountId = filters.accountId;
    if (filters.from || filters.to) {
      where.occurredAt = {};
      if (filters.from) where.occurredAt.gte = filters.from;
      if (filters.to) where.occurredAt.lte = filters.to;
    }
    return where;
  }

  async getSummary(filters: {
    legalEntityId: string;
    accountId?: string;
    from?: Date;
    to?: Date;
  }) {
    const where = this.buildLineWhere(filters);

    const grouped = await this.prisma.statementLine.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    const byStatus: Record<string, number> = {};
    for (const g of grouped as any[]) {
      byStatus[g.status] = g._count._all;
    }

    const splitParents = await this.prisma.statementLine.count({
      where: {
        ...(where as any),
        OR: [
          { status: (StatementLineStatus as any).SPLIT },
          { isSplitParent: true },
        ],
      },
    });

    const unexplainedCash = await this.countUnexplainedCash(filters);
    const postedMissingLinks = await this.countPostedMissingLinks(filters);

    return {
      counts: {
        new: byStatus[StatementLineStatus.NEW] ?? 0,
        suggested: byStatus[StatementLineStatus.SUGGESTED] ?? 0,
        matched: byStatus[StatementLineStatus.MATCHED] ?? 0,
        posted: byStatus[StatementLineStatus.POSTED] ?? 0,
        ignored: byStatus[StatementLineStatus.IGNORED] ?? 0,
        error: byStatus[StatementLineStatus.ERROR] ?? 0,
        splitParents,
        unexplainedCash,
        postedMissingLinks,
      },
    };
  }

  private async countUnexplainedCash(filters: {
    legalEntityId: string;
    accountId?: string;
    from?: Date;
    to?: Date;
  }): Promise<number> {
    const params: any[] = [filters.legalEntityId];
    let idx = 2;
    let whereSql = `sl."legalEntityId" = $1 AND sl."status" = 'POSTED' AND sl."postedMoneyTransactionId" IS NOT NULL`;
    if (filters.accountId) {
      whereSql += ` AND sl."accountId" = $${idx++}`;
      params.push(filters.accountId);
    }
    if (filters.from) {
      whereSql += ` AND sl."occurredAt" >= $${idx++}`;
      params.push(filters.from);
    }
    if (filters.to) {
      whereSql += ` AND sl."occurredAt" <= $${idx++}`;
      params.push(filters.to);
    }

    const rows: Array<{ c: bigint }> = await this.prisma.$queryRawUnsafe(
      `
      SELECT COUNT(*)::bigint as c
      FROM (
        SELECT sl.id
        FROM statement_lines sl
        JOIN money_transactions mt ON mt.id = sl."postedMoneyTransactionId"
        LEFT JOIN cash_accounting_links cl ON cl."moneyTransactionId" = mt.id
        WHERE ${whereSql}
        GROUP BY sl.id
        HAVING COUNT(cl.id) = 0
      ) t
      `,
      ...params,
    );
    return Number(rows[0]?.c ?? 0n);
  }

  private async countPostedMissingLinks(filters: {
    legalEntityId: string;
    accountId?: string;
    from?: Date;
    to?: Date;
  }): Promise<number> {
    const params: any[] = [filters.legalEntityId];
    let idx = 2;
    let whereSql = `sl."legalEntityId" = $1 AND sl."status" = 'POSTED' AND sl."matchedEntityType" = 'PAYMENT_EXECUTION'`;
    if (filters.accountId) {
      whereSql += ` AND sl."accountId" = $${idx++}`;
      params.push(filters.accountId);
    }
    if (filters.from) {
      whereSql += ` AND sl."occurredAt" >= $${idx++}`;
      params.push(filters.from);
    }
    if (filters.to) {
      whereSql += ` AND sl."occurredAt" <= $${idx++}`;
      params.push(filters.to);
    }

    const rows: Array<{ c: bigint }> = await this.prisma.$queryRawUnsafe(
      `
      SELECT COUNT(*)::bigint as c
      FROM (
        SELECT sl.id
        FROM statement_lines sl
        LEFT JOIN "AccountingEntry" ae
          ON ae."docType" = $${idx}::"AccountingDocType" AND ae."docId" = sl."matchedEntityId"
        LEFT JOIN cash_accounting_links cl
          ON cl."moneyTransactionId" = sl."postedMoneyTransactionId"
         AND cl."accountingEntryId" = ae.id
         AND cl."role" = $${idx + 1}::"CashAccountingLinkRole"
        WHERE ${whereSql}
          AND (ae.id IS NULL OR cl.id IS NULL)
      ) t
      `,
      ...params,
      AccountingDocType.PAYMENT_EXECUTION,
      CashAccountingLinkRole.PAYMENT_PRINCIPAL,
    );
    return Number(rows[0]?.c ?? 0n);
  }

  async getQueue(
    type: QueueType,
    filters: {
      legalEntityId: string;
      accountId?: string;
      from?: Date;
      to?: Date;
      limit?: number;
    },
  ) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const baseWhere = this.buildLineWhere(filters);

    if (
      type === 'NEW' ||
      type === 'SUGGESTED' ||
      type === 'MATCHED' ||
      type === 'ERROR'
    ) {
      const status =
        type === 'NEW'
          ? StatementLineStatus.NEW
          : type === 'SUGGESTED'
            ? StatementLineStatus.SUGGESTED
            : type === 'MATCHED'
              ? StatementLineStatus.MATCHED
              : StatementLineStatus.ERROR;

      const lines = await this.prisma.statementLine.findMany({
        where: { ...(baseWhere as any), status },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      });

      const items = lines.map((l) => ({
        line: l,
        diagnostics: this.getDiagnosticsForLine(l),
      }));
      return { type, items };
    }

    if (type === 'UNEXPLAINED_CASH') {
      const ids = await this.findUnexplainedCashLineIds(filters, limit);
      const lines = await this.prisma.statementLine.findMany({
        where: { id: { in: ids } } as any,
        orderBy: [{ occurredAt: 'desc' }],
      });
      return {
        type,
        items: lines.map((l) => ({
          line: l,
          diagnostics: ['no_cash_links_for_money_tx'],
        })),
      };
    }

    if (type === 'POSTED_MISSING_LINKS') {
      const ids = await this.findPostedMissingLinksLineIds(filters, limit);
      const lines = await this.prisma.statementLine.findMany({
        where: { id: { in: ids } } as any,
        orderBy: [{ occurredAt: 'desc' }],
      });
      return {
        type,
        items: lines.map((l) => ({
          line: l,
          diagnostics: ['missing_entry_or_cash_link'],
        })),
      };
    }

    throw new BadRequestException('Unknown queue type');
  }

  private getDiagnosticsForLine(line: any): string[] {
    const issues: string[] = [];
    if (line.status === StatementLineStatus.NEW) {
      if (
        line.suggestedMatch &&
        (line.suggestedMatch?.candidates?.length ?? 0) > 0
      ) {
        issues.push('new_has_suggestedMatch');
      }
    }
    if (line.status === StatementLineStatus.SUGGESTED) {
      if (
        !line.suggestedMatch ||
        (line.suggestedMatch?.candidates?.length ?? 0) === 0
      ) {
        issues.push('suggested_missing_candidates');
      }
      if (line.matchedEntityId) issues.push('suggested_has_matchedEntity');
    }
    if (line.status === StatementLineStatus.MATCHED) {
      if (!line.matchedEntityId) issues.push('matched_missing_entity');
      if (line.postedAt) issues.push('matched_has_postedAt');
    }
    if (line.status === StatementLineStatus.POSTED) {
      if (!line.postedAt) issues.push('posted_missing_postedAt');
      if (!line.postedMoneyTransactionId) issues.push('posted_missing_moneyTx');
      if (line.parentLineId && line.parent?.status !== 'SPLIT')
        issues.push('child_parent_not_split');
    }
    return issues;
  }

  private async findUnexplainedCashLineIds(
    filters: {
      legalEntityId: string;
      accountId?: string;
      from?: Date;
      to?: Date;
    },
    limit: number,
  ): Promise<string[]> {
    const params: any[] = [filters.legalEntityId, limit];
    let idx = 3;
    let whereSql = `sl."legalEntityId" = $1 AND sl."status" = 'POSTED' AND sl."postedMoneyTransactionId" IS NOT NULL`;
    if (filters.accountId) {
      whereSql += ` AND sl."accountId" = $${idx++}`;
      params.push(filters.accountId);
    }
    if (filters.from) {
      whereSql += ` AND sl."occurredAt" >= $${idx++}`;
      params.push(filters.from);
    }
    if (filters.to) {
      whereSql += ` AND sl."occurredAt" <= $${idx++}`;
      params.push(filters.to);
    }

    const rows: Array<{ id: string }> = await this.prisma.$queryRawUnsafe(
      `
      SELECT sl.id
      FROM statement_lines sl
      JOIN money_transactions mt ON mt.id = sl."postedMoneyTransactionId"
      LEFT JOIN cash_accounting_links cl ON cl."moneyTransactionId" = mt.id
      WHERE ${whereSql}
      GROUP BY sl.id
      HAVING COUNT(cl.id) = 0
      ORDER BY MAX(sl."occurredAt") DESC
      LIMIT $2
      `,
      ...params,
    );
    return rows.map((r) => r.id);
  }

  private async findPostedMissingLinksLineIds(
    filters: {
      legalEntityId: string;
      accountId?: string;
      from?: Date;
      to?: Date;
    },
    limit: number,
  ): Promise<string[]> {
    const params: any[] = [filters.legalEntityId, limit];
    let idx = 3;
    let whereSql = `sl."legalEntityId" = $1 AND sl."status" = 'POSTED' AND sl."matchedEntityType" = 'PAYMENT_EXECUTION'`;
    if (filters.accountId) {
      whereSql += ` AND sl."accountId" = $${idx++}`;
      params.push(filters.accountId);
    }
    if (filters.from) {
      whereSql += ` AND sl."occurredAt" >= $${idx++}`;
      params.push(filters.from);
    }
    if (filters.to) {
      whereSql += ` AND sl."occurredAt" <= $${idx++}`;
      params.push(filters.to);
    }

    const rows: Array<{ id: string }> = await this.prisma.$queryRawUnsafe(
      `
      SELECT sl.id
      FROM statement_lines sl
      LEFT JOIN "AccountingEntry" ae
        ON ae."docType" = $${idx}::"AccountingDocType" AND ae."docId" = sl."matchedEntityId"
      LEFT JOIN cash_accounting_links cl
        ON cl."moneyTransactionId" = sl."postedMoneyTransactionId"
       AND cl."accountingEntryId" = ae.id
       AND cl."role" = $${idx + 1}::"CashAccountingLinkRole"
      WHERE ${whereSql}
        AND (ae.id IS NULL OR cl.id IS NULL)
      ORDER BY sl."occurredAt" DESC
      LIMIT $2
      `,
      ...params,
      AccountingDocType.PAYMENT_EXECUTION,
      CashAccountingLinkRole.PAYMENT_PRINCIPAL,
    );
    return rows.map((r) => r.id);
  }

  async ignoreLine(id: string, reason?: string) {
    const line = await this.prisma.statementLine.findUnique({ where: { id } });
    if (!line) throw new NotFoundException('StatementLine not found');
    if (line.status === StatementLineStatus.POSTED || line.postedAt) {
      throw new ConflictException('Cannot ignore a POSTED line');
    }
    return this.prisma.statementLine.update({
      where: { id },
      data: {
        status: StatementLineStatus.IGNORED,
        ignoredAt: new Date(),
        ignoredReason: reason ?? null,
      } as any,
    });
  }

  async unignoreLine(id: string) {
    const line = await this.prisma.statementLine.findUnique({ where: { id } });
    if (!line) throw new NotFoundException('StatementLine not found');
    if (line.status !== StatementLineStatus.IGNORED) {
      throw new ConflictException('Only IGNORED line can be unignored');
    }
    const nextStatus = line.suggestedMatch
      ? StatementLineStatus.SUGGESTED
      : StatementLineStatus.NEW;
    return this.prisma.statementLine.update({
      where: { id },
      data: {
        status: nextStatus,
        ignoredAt: null,
        ignoredReason: null,
      } as any,
    });
  }

  async clearError(id: string) {
    const line = await this.prisma.statementLine.findUnique({ where: { id } });
    if (!line) throw new NotFoundException('StatementLine not found');
    if (line.status !== StatementLineStatus.ERROR) {
      throw new ConflictException('Only ERROR line can be cleared');
    }
    const nextStatus = line.suggestedMatch
      ? StatementLineStatus.SUGGESTED
      : StatementLineStatus.NEW;
    return this.prisma.statementLine.update({
      where: { id },
      data: {
        status: nextStatus,
        errorMessage: null,
      } as any,
    });
  }

  async retrySuggest(id: string) {
    return this.matcher.suggestForLine(id);
  }

  async retryPost(id: string) {
    // posting service enforces status rules; for retry we allow ERROR by converting it to MATCHED if possible
    const line = await this.prisma.statementLine.findUnique({ where: { id } });
    if (!line) throw new NotFoundException('StatementLine not found');
    if (line.status === StatementLineStatus.ERROR) {
      if (!line.matchedEntityType || !line.matchedEntityId) {
        throw new ConflictException(
          'ERROR line has no matched entity; cannot retry post',
        );
      }
      await this.prisma.statementLine.update({
        where: { id },
        data: { status: StatementLineStatus.MATCHED } as any,
      });
    }
    return this.posting.postLine(id);
  }

  async batchRetrySuggest(filters: {
    legalEntityId: string;
    accountId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const where = this.buildLineWhere(filters);
    const ids = await this.prisma.statementLine.findMany({
      where: {
        ...(where as any),
        status: { in: [StatementLineStatus.NEW, StatementLineStatus.ERROR] },
      },
      select: { id: true },
      orderBy: [{ occurredAt: 'desc' }],
      take: limit,
    });
    let processed = 0;
    let suggested = 0;
    for (const l of ids) {
      processed += 1;
      const res = await this.matcher.suggestForLine(l.id);
      if (res.status === StatementLineStatus.SUGGESTED) suggested += 1;
    }
    return { processed, suggested };
  }

  async batchRetryPost(filters: {
    legalEntityId: string;
    accountId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }) {
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const where = this.buildLineWhere(filters);
    const ids = await this.prisma.statementLine.findMany({
      where: {
        ...(where as any),
        status: {
          in: [StatementLineStatus.MATCHED, StatementLineStatus.ERROR],
        },
      },
      select: { id: true },
      orderBy: [{ occurredAt: 'asc' }],
      take: limit,
    });
    let processed = 0;
    let posted = 0;
    let failed = 0;
    for (const l of ids) {
      processed += 1;
      try {
        await this.retryPost(l.id);
        posted += 1;
      } catch {
        failed += 1;
      }
    }
    return { processed, posted, failed };
  }

  async batchIgnore(ids: string[], reason: string) {
    if (!ids?.length) throw new BadRequestException('ids is required');
    if (!reason) throw new BadRequestException('reason is required');
    const now = new Date();
    const res = await this.prisma.statementLine.updateMany({
      where: {
        id: { in: ids },
        status: { not: StatementLineStatus.POSTED } as any,
        postedAt: null,
      } as any,
      data: {
        status: StatementLineStatus.IGNORED,
        ignoredAt: now,
        ignoredReason: reason,
      } as any,
    });
    return { updated: res.count };
  }
}
