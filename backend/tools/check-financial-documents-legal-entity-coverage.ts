import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS cnt FROM "financial_documents" WHERE "legalEntityId" IS NULL`,
    )) as Array<{ cnt: number }>;
    const missingCount = rows?.[0]?.cnt ?? 0;

    if (missingCount === 0) {
      console.log('OK: All financial_documents rows have legalEntityId.');
      return;
    }

    const breakdown = (await prisma.$queryRawUnsafe(
      `SELECT COALESCE("linkedDocType"::text,'(null)') AS "linkedDocType", COUNT(*)::int AS cnt
       FROM "financial_documents"
       WHERE "legalEntityId" IS NULL
       GROUP BY COALESCE("linkedDocType"::text,'(null)')
       ORDER BY cnt DESC`,
    )) as Array<{ linkedDocType: string; cnt: number }>;

    const sample = (await prisma.$queryRawUnsafe(
      `SELECT "id","docNumber","docDate","type","status","supplierId","linkedDocType","linkedDocId","scmSupplyId","productionOrderId"
       FROM "financial_documents"
       WHERE "legalEntityId" IS NULL
       ORDER BY "createdAt" DESC
       LIMIT 50`,
    )) as Array<Record<string, unknown>>;

    console.error(`ERROR: Missing legalEntityId on financial_documents rows: ${missingCount}`);
    console.error('Breakdown by linkedDocType:');
    for (const b of breakdown) {
      console.error(`${b.linkedDocType}: ${b.cnt}`);
    }
    console.error('Sample (up to 50):');
    for (const e of sample) {
      console.error(JSON.stringify(e));
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});



async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS cnt FROM "financial_documents" WHERE "legalEntityId" IS NULL`,
    )) as Array<{ cnt: number }>;
    const missingCount = rows?.[0]?.cnt ?? 0;

    if (missingCount === 0) {
      console.log('OK: All financial_documents rows have legalEntityId.');
      return;
    }

    const breakdown = (await prisma.$queryRawUnsafe(
      `SELECT COALESCE("linkedDocType"::text,'(null)') AS "linkedDocType", COUNT(*)::int AS cnt
       FROM "financial_documents"
       WHERE "legalEntityId" IS NULL
       GROUP BY COALESCE("linkedDocType"::text,'(null)')
       ORDER BY cnt DESC`,
    )) as Array<{ linkedDocType: string; cnt: number }>;

    const sample = (await prisma.$queryRawUnsafe(
      `SELECT "id","docNumber","docDate","type","status","supplierId","linkedDocType","linkedDocId","scmSupplyId","productionOrderId"
       FROM "financial_documents"
       WHERE "legalEntityId" IS NULL
       ORDER BY "createdAt" DESC
       LIMIT 50`,
    )) as Array<Record<string, unknown>>;

    console.error(`ERROR: Missing legalEntityId on financial_documents rows: ${missingCount}`);
    console.error('Breakdown by linkedDocType:');
    for (const b of breakdown) {
      console.error(`${b.linkedDocType}: ${b.cnt}`);
    }
    console.error('Sample (up to 50):');
    for (const e of sample) {
      console.error(JSON.stringify(e));
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


