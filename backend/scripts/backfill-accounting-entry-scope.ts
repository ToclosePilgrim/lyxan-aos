/* eslint-disable no-console */
import { PrismaClient, AccountingDocType } from '@prisma/client';
import { resolveAccountingEntryScope } from '../src/modules/finance/accounting-entry/accounting-entry-scope';
import * as fs from 'node:fs';
import * as path from 'node:path';

type Unresolved = {
  id: string;
  docType: AccountingDocType;
  docId: string;
  sourceDocType?: AccountingDocType | null;
  sourceDocId?: string | null;
  reason: string;
};

async function main() {
  const prisma = new PrismaClient();
  const unresolved: Unresolved[] = [];

  const BATCH = Number(process.env.BATCH_SIZE ?? 200);
  let totalScanned = 0;
  let totalUpdated = 0;

  // After C.3.1, countryId/brandId are NOT NULL in DB. Keep script compilable and safe:
  // we just scan all entries and (re)apply derived scope.
  const where = {};

  console.log(`[backfill] Start. batch=${BATCH}`);

  let cursor: { id: string } | undefined;

  while (true) {
    const batch = await prisma.accountingEntry.findMany({
      where,
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor } : {}),
      select: {
        id: true,
        docType: true,
        docId: true,
        sourceDocType: true,
        sourceDocId: true,
        countryId: true,
        brandId: true,
        marketplaceId: true,
        warehouseId: true,
      },
    });

    if (batch.length === 0) break;

    for (const e of batch) {
      totalScanned += 1;
      try {
        const scope = await resolveAccountingEntryScope({
          client: prisma,
          docType: e.docType,
          docId: e.docId,
          sourceDocType: e.sourceDocType ?? null,
          sourceDocId: e.sourceDocId ?? null,
          countryId: e.countryId ?? undefined,
          brandId: e.brandId ?? undefined,
          marketplaceId: e.marketplaceId ?? null,
          warehouseId: e.warehouseId ?? null,
        });

        await prisma.accountingEntry.update({
          where: { id: e.id },
          data: {
            countryId: scope.countryId,
            brandId: scope.brandId,
            marketplaceId: scope.marketplaceId ?? null,
            warehouseId: scope.warehouseId ?? null,
          },
        });
        totalUpdated += 1;
      } catch (err: any) {
        unresolved.push({
          id: e.id,
          docType: e.docType,
          docId: e.docId,
          sourceDocType: e.sourceDocType ?? null,
          sourceDocId: e.sourceDocId ?? null,
          reason: err?.message ?? String(err),
        });
      }
    }

    cursor = { id: batch[batch.length - 1].id };
    if (totalScanned % (BATCH * 5) === 0) {
      console.log(`[backfill] scanned=${totalScanned} updated=${totalUpdated} unresolved=${unresolved.length}`);
    }
  }

  const outPath = path.join(
    process.cwd(),
    'scripts',
    'backfill-accounting-entry-scope.unresolved.json',
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(unresolved, null, 2), 'utf8');

  console.log(`[backfill] Done. scanned=${totalScanned} updated=${totalUpdated} unresolved=${unresolved.length}`);
  console.log(`[backfill] unresolved file: ${outPath}`);

  await prisma.$disconnect();

  if (unresolved.length > 0) {
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error('[backfill] Fatal:', e);
  process.exitCode = 1;
});


