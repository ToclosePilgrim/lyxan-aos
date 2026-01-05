import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    // Use raw SQL because after TZ 1.1 the Prisma type is non-nullable,
    // but we still want to detect any unexpected nulls (drift / bad data).
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS cnt FROM "AccountingEntry" WHERE "legalEntityId" IS NULL`,
    )) as Array<{ cnt: number }>;
    const missingCount = rows?.[0]?.cnt ?? 0;

    if (missingCount === 0) {
      console.log('OK: All AccountingEntry rows have legalEntityId.');
      return;
    }

    const sample = (await prisma.$queryRawUnsafe(
      `SELECT "id","docType","docId","postingDate","brandId","countryId"
       FROM "AccountingEntry"
       WHERE "legalEntityId" IS NULL
       ORDER BY "postingDate" DESC
       LIMIT 50`,
    )) as Array<{
      id: string;
      docType: string;
      docId: string;
      postingDate: Date;
      brandId: string;
      countryId: string;
    }>;

    console.error(`ERROR: Missing legalEntityId on AccountingEntry rows: ${missingCount}`);
    console.error('Sample (up to 50):');
    for (const e of sample) {
      console.error(
        `${e.id} doc=${e.docType}/${e.docId} postingDate=${e.postingDate.toISOString()} brand=${e.brandId} country=${e.countryId}`,
      );
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
    // Use raw SQL because after TZ 1.1 the Prisma type is non-nullable,
    // but we still want to detect any unexpected nulls (drift / bad data).
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS cnt FROM "AccountingEntry" WHERE "legalEntityId" IS NULL`,
    )) as Array<{ cnt: number }>;
    const missingCount = rows?.[0]?.cnt ?? 0;

    if (missingCount === 0) {
      console.log('OK: All AccountingEntry rows have legalEntityId.');
      return;
    }

    const sample = (await prisma.$queryRawUnsafe(
      `SELECT "id","docType","docId","postingDate","brandId","countryId"
       FROM "AccountingEntry"
       WHERE "legalEntityId" IS NULL
       ORDER BY "postingDate" DESC
       LIMIT 50`,
    )) as Array<{
      id: string;
      docType: string;
      docId: string;
      postingDate: Date;
      brandId: string;
      countryId: string;
    }>;

    console.error(`ERROR: Missing legalEntityId on AccountingEntry rows: ${missingCount}`);
    console.error('Sample (up to 50):');
    for (const e of sample) {
      console.error(
        `${e.id} doc=${e.docType}/${e.docId} postingDate=${e.postingDate.toISOString()} brand=${e.brandId} country=${e.countryId}`,
      );
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


