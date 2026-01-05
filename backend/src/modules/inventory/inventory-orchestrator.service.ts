import { Injectable } from '@nestjs/common';
import { AccountingDocType, InventoryDirection, Prisma } from '@prisma/client';
import { FifoInventoryService } from './fifo.service';
import { InventoryService } from './inventory.service';
import { InventoryEventsService } from './inventory-events.service';
import {
  InventoryBatchSourceType,
  InventoryDocumentType,
  InventoryMovementType,
} from './inventory.enums';

export interface MovementOperation {
  warehouseId: string;
  itemId: string;
  quantity: Prisma.Decimal | number | string;
  docType: InventoryDocumentType;
  docId: string;
  movementType: InventoryMovementType;
  occurredAt?: Date;
  meta?: Record<string, unknown>;
  /**
   * First-class receipt link for supply income movements (TZ 0.3).
   * Must be set for movements created as part of a supply receipt.
   */
  supplyReceiptId?: string | null;
  currency?: string;
  breakdown?: {
    baseUnitCost?: Prisma.Decimal | number | string;
    logisticsUnitCost?: Prisma.Decimal | number | string;
    customsUnitCost?: Prisma.Decimal | number | string;
    inboundUnitCost?: Prisma.Decimal | number | string;
  };
  unitCost?: Prisma.Decimal | number | string;
  batchSourceType?: InventoryBatchSourceType;
  sourceDocType?: AccountingDocType;
  sourceDocId?: string;
}

@Injectable()
export class InventoryOrchestratorService {
  constructor(
    private readonly fifo: FifoInventoryService,
    private readonly inventory: InventoryService,
    private readonly inventoryEvents: InventoryEventsService,
  ) {}

  async recordIncome(op: MovementOperation, tx: Prisma.TransactionClient) {
    const income = await this.fifo.recordIncome({
      itemId: op.itemId,
      warehouseId: op.warehouseId,
      quantity: op.quantity,
      unitCost: op.unitCost ?? undefined,
      currency: op.currency ?? 'RUB',
      docType: op.docType,
      docId: op.docId,
      batchSourceType: op.batchSourceType ?? InventoryBatchSourceType.SUPPLY,
      movementType: op.movementType,
      supplyReceiptId: op.supplyReceiptId ?? undefined,
      meta: op.meta,
      occurredAt: op.occurredAt ?? new Date(),
      breakdown: op.breakdown,
      tx,
    });

    const txn = await tx.inventoryTransaction.create({
      data: {
        warehouseId: op.warehouseId,
        itemId: op.itemId,
        quantity: new Prisma.Decimal(op.quantity),
        direction: InventoryDirection.IN,
        docType: op.docType,
        docId: op.docId,
        stockMovementId: income.id,
      },
    });

    await tx.stockMovement.update({
      where: { id: income.id },
      data: {
        inventoryTransactionId: txn.id,
        sourceDocType: op.sourceDocType ?? null,
        sourceDocId: op.sourceDocId ?? null,
      },
    });

    await this.inventory.adjustBalanceWithTx(tx, {
      warehouseId: op.warehouseId,
      itemId: op.itemId,
      quantityDelta: Number(op.quantity),
    });

    await this.inventoryEvents.emitStockChanged(tx, {
      warehouseId: op.warehouseId,
      itemId: op.itemId,
      qtyDelta: Number(op.quantity),
      movementType: op.movementType,
      movementId: income.id,
      sourceDocType: op.sourceDocType ?? AccountingDocType.OTHER,
      sourceDocId: op.sourceDocId ?? op.docId,
    });

    return { movementId: income.id, transactionId: txn.id };
  }

  async recordOutcome(op: MovementOperation, tx: Prisma.TransactionClient) {
    const outcome = await this.fifo.recordOutcome({
      itemId: op.itemId,
      warehouseId: op.warehouseId,
      quantity: op.quantity,
      docType: op.docType,
      docId: op.docId,
      meta: op.meta,
      tx,
      movementType: op.movementType,
    });

    const txn = await tx.inventoryTransaction.create({
      data: {
        warehouseId: op.warehouseId,
        itemId: op.itemId,
        quantity: new Prisma.Decimal(op.quantity),
        direction: InventoryDirection.OUT,
        docType: op.docType,
        docId: op.docId,
        stockMovementId: outcome.movements[0]?.id ?? null,
      },
    });

    for (const mv of outcome.movements) {
      await tx.stockMovement.update({
        where: { id: mv.id },
        data: {
          inventoryTransactionId: txn.id,
          sourceDocType: op.sourceDocType ?? null,
          sourceDocId: op.sourceDocId ?? null,
        },
      });
    }

    await this.inventory.adjustBalanceWithTx(tx, {
      warehouseId: op.warehouseId,
      itemId: op.itemId,
      quantityDelta: -Number(op.quantity),
    });

    const firstQtyDelta =
      outcome.movements[0]?.quantity !== undefined &&
      outcome.movements[0]?.quantity !== null
        ? Number(outcome.movements[0].quantity)
        : -Number(op.quantity);

    await this.inventoryEvents.emitStockChanged(tx, {
      warehouseId: op.warehouseId,
      itemId: op.itemId,
      qtyDelta: firstQtyDelta,
      movementType: op.movementType,
      movementId: outcome.movements[0]?.id ?? null,
      sourceDocType: op.sourceDocType ?? AccountingDocType.OTHER,
      sourceDocId: op.sourceDocId ?? op.docId,
    });

    return {
      movementIds: outcome.movements.map((m) => m.id),
      transactionId: txn.id,
      totalCost: outcome.totalCost,
      currency: outcome.currency,
    };
  }
}
