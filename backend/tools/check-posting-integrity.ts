import { PrismaClient, PostingRunStatus, MoneyTransactionSourceType, MoneyTransactionStatus, AccountingDocType } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const issues: string[] = [];

    // 1) At most one active POSTED run per (docType, docId)
    const postedRuns = await prisma.accountingPostingRun.findMany({
      where: { status: PostingRunStatus.POSTED } as any,
      select: { docType: true, docId: true, id: true, version: true },
      take: 200000,
    });
    const byDoc = new Map<string, any[]>();
    for (const r of postedRuns as any[]) {
      const k = `${r.docType}:${r.docId}`;
      const arr = byDoc.get(k) ?? [];
      arr.push(r);
      byDoc.set(k, arr);
    }
    for (const [k, arr] of byDoc.entries()) {
      if (arr.length > 1) {
        issues.push(`Multiple POSTED runs for ${k}: ${arr.map((x) => `${x.id}@v${x.version}`).join(', ')}`);
      }
    }

    // 2) No controlled entries without postingRunId
    const controlledDocTypes: AccountingDocType[] = [
      AccountingDocType.SALES_DOCUMENT,
      AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL,
      AccountingDocType.PAYMENT_EXECUTION,
      AccountingDocType.INTERNAL_TRANSFER,
    ];
    // Allow legacy rows created before TZ 8.1 migration was applied.
    const mig = (await prisma.$queryRawUnsafe<any[]>(
      `SELECT finished_at FROM "_prisma_migrations" WHERE migration_name = '20251223203000_posting_runs_and_void_fields' AND rolled_back_at IS NULL ORDER BY finished_at DESC LIMIT 1`,
    ))?.[0];
    const cutoff = mig?.finished_at ? new Date(mig.finished_at) : null;

    const orphanEntries = await prisma.accountingEntry.findFirst({
      where: {
        docType: { in: controlledDocTypes },
        postingRunId: null,
        ...(cutoff ? { createdAt: { gt: cutoff } } : {}),
      } as any,
      select: { id: true, docType: true, docId: true, createdAt: true },
    });
    if (orphanEntries) {
      issues.push(
        `Found accounting entry without postingRunId: ${orphanEntries.id} (${orphanEntries.docType}:${orphanEntries.docId}) createdAt=${orphanEntries.createdAt.toISOString()}`,
      );
    }

    // 3) PaymentExecution: POSTED moneyTx should have at least one accounting entry (payment execution)
    const peTx = await prisma.moneyTransaction.findMany({
      where: { sourceType: MoneyTransactionSourceType.PAYMENT_EXECUTION, status: MoneyTransactionStatus.POSTED } as any,
      select: { sourceId: true },
      take: 5000,
    });
    const peIds = Array.from(new Set(peTx.map((t) => t.sourceId).filter(Boolean))) as string[];
    if (peIds.length) {
      const entries = await prisma.accountingEntry.findMany({
        where: { docType: AccountingDocType.PAYMENT_EXECUTION, docId: { in: peIds } } as any,
        select: { docId: true },
      });
      const has = new Set(entries.map((e) => e.docId));
      for (const id of peIds) {
        if (!has.has(id)) issues.push(`PaymentExecution moneyTx POSTED but no AccountingEntry: ${id}`);
      }
    }

    // 4) Internal transfer: both legs should share same status
    const legs = await prisma.moneyTransaction.findMany({
      where: { sourceType: MoneyTransactionSourceType.INTERNAL_TRANSFER } as any,
      select: { sourceId: true, status: true },
      take: 20000,
    });
    const byGroup = new Map<string, Set<string>>();
    for (const l of legs) {
      if (!l.sourceId) continue;
      const set = byGroup.get(l.sourceId) ?? new Set<string>();
      set.add(String(l.status));
      byGroup.set(l.sourceId, set);
    }
    for (const [gid, st] of byGroup.entries()) {
      if (st.size > 1) issues.push(`InternalTransfer ${gid} has mixed MoneyTransaction statuses: ${Array.from(st).join(',')}`);
    }

    if (issues.length) {
      // eslint-disable-next-line no-console
      console.error(`Posting integrity check FAILED (${issues.length} issues):`);
      for (const i of issues) console.error(`- ${i}`);
      process.exitCode = 1;
      return;
    }

    // eslint-disable-next-line no-console
    console.log('Posting integrity check OK');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});


