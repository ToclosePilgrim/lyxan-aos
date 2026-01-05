import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
  }) {
    const { tx, movementIds, entryIds, role } = params;
    for (const movementId of movementIds) {
      for (const entryId of entryIds) {
        await tx.inventoryAccountingLink
          .create({
            data: {
              stockMovementId: movementId,
              accountingEntryId: entryId,
              role: role ?? null,
            },
          })
          .catch(() => {
            // ignore duplicates (unique constraint)
          });
      }
    }
  }
}

