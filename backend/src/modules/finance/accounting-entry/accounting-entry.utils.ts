import { AccountingDocType, Prisma } from '@prisma/client';

/**
 * Returns next sequential lineNumber within a (docType, docId) group.
 * Must be called inside the same tx that will create the entry.
 */
export async function getNextLineNumber(
  tx: Prisma.TransactionClient,
  docType: AccountingDocType,
  docId: string,
): Promise<number> {
  const agg = await tx.accountingEntry.aggregate({
    where: { docType, docId },
    _max: { lineNumber: true },
  });
  const max = agg._max.lineNumber ?? 0;
  return max + 1;
}
