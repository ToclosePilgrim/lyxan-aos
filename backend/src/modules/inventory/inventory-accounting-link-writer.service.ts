import { Injectable } from '@nestjs/common';
import { InventoryAccountingLinkType, Prisma } from '@prisma/client';
import { InventoryAccountingLinkRole } from './inventory.enums';

@Injectable()
export class InventoryAccountingLinkWriterService {
  /**
   * Write-only helper for InventoryAccountingLink.
   * Must be used outside inventory module instead of calling `tx.inventoryAccountingLink.*` directly.
   */
  async link(params: {
    tx: Prisma.TransactionClient;
    movementIds: string[];
    entryIds: string[];
    role?: InventoryAccountingLinkRole | null;
    movementAmountBase?: Record<string, Prisma.Decimal | string | number>;
    linkType?: InventoryAccountingLinkType | null;
    postingRunId?: string | null;
    movementMeta?: Record<
      string,
      { inventoryTransactionId?: string | null; batchId?: string | null }
    >;
  }) {
    const {
      tx,
      movementIds,
      entryIds,
      role,
      movementAmountBase,
      linkType,
      postingRunId,
      movementMeta,
    } = params;
    for (const movementId of movementIds) {
      for (const entryId of entryIds) {
        await tx.inventoryAccountingLink
          .create({
            data: {
              stockMovementId: movementId,
              accountingEntryId: entryId,
              role: role ?? null,
              amountBase:
                movementAmountBase && movementAmountBase[movementId] !== undefined
                  ? new Prisma.Decimal(movementAmountBase[movementId] as any)
                  : null,
              linkType: linkType ?? null,
              postingRunId: postingRunId ?? null,
              inventoryTransactionId:
                movementMeta?.[movementId]?.inventoryTransactionId ?? null,
              batchId: movementMeta?.[movementId]?.batchId ?? null,
            },
          })
          .catch(() => {
            // ignore duplicates (unique constraint)
          });
      }
    }
  }
}




