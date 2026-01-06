import { Injectable } from '@nestjs/common';
import { AccountingDocType, Prisma } from '@prisma/client';
import { OsEventsService } from '../os-events/os-events.service';
import { OsEventType } from '../os-events/os-events.types';
import { InventoryMovementType } from './inventory.enums';

@Injectable()
export class InventoryEventsService {
  constructor(private readonly osEvents: OsEventsService) {}

  async emitStockChanged(
    tx: Prisma.TransactionClient,
    params: {
      warehouseId: string;
      itemId: string;
      qtyDelta: number;
      movementType: InventoryMovementType;
      movementId: string | null;
      batchId?: string | null;
      sourceDocType: AccountingDocType;
      sourceDocId: string;
      docType?: string | null;
      docId?: string | null;
      inventoryTransactionId?: string | null;
      eventVersion?: number;
    },
  ) {
    await this.osEvents.emitEvent(tx, {
      type: OsEventType.INVENTORY_STOCK_CHANGED,
      version: params.eventVersion ?? 1,
      aggregateType: 'ITEM_IN_WAREHOUSE',
      aggregateId: `${params.warehouseId}:${params.itemId}`,
      source: 'InventoryOrchestrator',
      payload: {
        eventType: 'STOCK_CHANGED',
        eventVersion: params.eventVersion ?? 1,
        occurredAt: new Date().toISOString(),
        warehouseId: params.warehouseId,
        itemId: params.itemId,
        movementId: params.movementId,
        batchId: params.batchId ?? null,
        qtyDelta: params.qtyDelta,
        movementType: params.movementType,
        docType: params.docType ?? null,
        docId: params.docId ?? null,
        sourceDocType: params.sourceDocType,
        sourceDocId: params.sourceDocId,
        inventoryTransactionId: params.inventoryTransactionId ?? null,
      },
    });
  }

  async emitAdjustmentPosted(
    tx: Prisma.TransactionClient,
    params: {
      adjustment: {
        id: string;
        warehouseId: string;
        itemId: string;
        quantity: Prisma.Decimal | number;
      };
      movementId: string | null;
      entryId?: string | null;
      unitCost?: number | string | null;
      totalCost?: number | string | null;
    },
  ) {
    const qty =
      typeof params.adjustment.quantity === 'number'
        ? params.adjustment.quantity
        : Number(params.adjustment.quantity);

    await this.osEvents.emitEvent(tx, {
      type: OsEventType.INVENTORY_ADJUSTMENT_POSTED,
      aggregateType: 'INVENTORY_ADJUSTMENT',
      aggregateId: params.adjustment.id,
      payload: {
        adjustmentId: params.adjustment.id,
        warehouseId: params.adjustment.warehouseId,
        itemId: params.adjustment.itemId,
        quantityDelta: qty,
        direction: qty > 0 ? 'IN' : 'OUT',
        unitCost:
          params.unitCost !== undefined && params.unitCost !== null
            ? Number(params.unitCost)
            : null,
        totalCost:
          params.totalCost !== undefined && params.totalCost !== null
            ? Number(params.totalCost)
            : null,
        movementId: params.movementId,
        entryId: params.entryId ?? null,
        sourceDocType: AccountingDocType.INVENTORY_ADJUSTMENT,
        sourceDocId: params.adjustment.id,
      },
      source: 'Inventory',
    });
  }

  async emitTransferPosted(
    tx: Prisma.TransactionClient,
    params: {
      transfer: { id: string; fromWarehouseId: string; toWarehouseId: string };
      itemId: string;
      quantity: number;
      outMovementId: string;
      inMovementId: string;
    },
  ) {
    await this.osEvents.emitEvent(tx, {
      type: OsEventType.INVENTORY_TRANSFER_POSTED,
      aggregateType: 'STOCK_TRANSFER',
      aggregateId: params.transfer.id,
      payload: {
        transferId: params.transfer.id,
        fromWarehouseId: params.transfer.fromWarehouseId,
        toWarehouseId: params.transfer.toWarehouseId,
        itemId: params.itemId,
        quantity: params.quantity,
        outMovementId: params.outMovementId,
        inMovementId: params.inMovementId,
        sourceDocType: AccountingDocType.STOCK_TRANSFER,
        sourceDocId: params.transfer.id,
      },
      source: 'TransfersService',
    });
  }
}
