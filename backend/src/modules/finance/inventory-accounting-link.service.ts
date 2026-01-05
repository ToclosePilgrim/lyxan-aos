import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InventoryAccountingLinkRole } from '../inventory/inventory.enums';
import { InventoryAccountingLinkWriterService } from '../inventory/inventory-accounting-link-writer.service';

export interface LinkParams {
  tx: Prisma.TransactionClient;
  movementWhere: Prisma.StockMovementWhereInput;
  entryWhere: Prisma.AccountingEntryWhereInput;
  role?: InventoryAccountingLinkRole | null;
}

@Injectable()
export class InventoryAccountingLinkService {
  constructor(private readonly writer: InventoryAccountingLinkWriterService) {}

  async link(params: LinkParams) {
    const { tx, movementWhere, entryWhere, role } = params;
    const [movements, entries] = await Promise.all([
      tx.stockMovement.findMany({ where: movementWhere }),
      tx.accountingEntry.findMany({ where: entryWhere }),
    ]);

    await this.writer.link({
      tx,
      movementIds: movements.map((m) => m.id),
      entryIds: entries.map((e) => e.id),
      role,
    });
  }
}
