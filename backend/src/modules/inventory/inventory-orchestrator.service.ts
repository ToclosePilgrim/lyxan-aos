import { ConflictException, Injectable } from '@nestjs/common';
import {
  AccountingDocType,
  InventoryDirection,
  Prisma,
  StockMovement,
} from '@prisma/client';
import { FifoInventoryService } from './fifo.service';
import { InventoryService } from './inventory.service';
import { InventoryEventsService } from './inventory-events.service';
import {
  InventoryBatchSourceType,
  InventoryDocumentType,
  InventoryMovementType,
} from './inventory.enums';
import {
  buildInventoryTransactionIdempotencyKey,
  buildStockMovementIdempotencyKey,
} from './inventory-idempotency.util';
import { getBaseCurrency } from '../finance/constants';

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

export type InventoryOutcomeResult = {
  movementIds: string[];
  movements: StockMovement[];
  transactionId: string;
  totalCost: Prisma.Decimal;
  totalCostBase: Prisma.Decimal;
  currency: string;
  baseCurrency: string;
};

@Injectable()
export class InventoryOrchestratorService {
  constructor(
    private readonly fifo: FifoInventoryService,
    private readonly inventory: InventoryService,
    private readonly inventoryEvents: InventoryEventsService,
  ) {}

  private async computeTotalCostBaseFromMovements(
    tx: Prisma.TransactionClient,
    movements: StockMovement[],
  ): Promise<Prisma.Decimal> {
    // Prefer explicit per-movement lineCostBase from meta (canonical),
    // fallback to StockBatch.unitCostBase * abs(qty).
    const base = new Prisma.Decimal(0);
    const byBatch = new Map<string, Prisma.Decimal>();

    let total = base;
    const batchIds: string[] = [];

    for (const m of movements) {
      const meta: any = (m as any)?.meta ?? {};
      const lineCostBaseStr =
        meta && typeof meta.lineCostBase === 'string' ? meta.lineCostBase : null;
      if (lineCostBaseStr) {
        total = total.add(new Prisma.Decimal(lineCostBaseStr));
        continue;
      }
      if (m.batchId) batchIds.push(m.batchId);
    }

    if (!batchIds.length) return total;

    const uniqueBatchIds = Array.from(new Set(batchIds));
    const batches = await tx.stockBatch.findMany({
      where: { id: { in: uniqueBatchIds } },
      select: { id: true, unitCostBase: true },
    });
    for (const b of batches as any[]) {
      if (b.unitCostBase !== null && b.unitCostBase !== undefined) {
        byBatch.set(b.id, new Prisma.Decimal(b.unitCostBase));
      }
    }

    for (const m of movements) {
      const meta: any = (m as any)?.meta ?? {};
      const lineCostBaseStr =
        meta && typeof meta.lineCostBase === 'string' ? meta.lineCostBase : null;
      if (lineCostBaseStr) continue; // already counted
      if (!m.batchId) continue;
      const unitCostBase = byBatch.get(m.batchId);
      if (!unitCostBase) continue;
      const qtyAbs = new Prisma.Decimal((m as any).quantity).abs();
      total = total.add(unitCostBase.mul(qtyAbs));
    }

    return total;
  }

  private async adjustBalanceWithTx(
    tx: Prisma.TransactionClient,
    params: { warehouseId: string; itemId: string; quantityDelta: number },
  ) {
    // InventoryBalance is a read-model maintained by canonical inventory services.
    // Use upsert on the canonical UNIQUE(warehouseId, itemId) to stay race-safe.
    await (tx as any).inventoryBalance.upsert({
      where: {
        warehouseId_itemId: {
          warehouseId: params.warehouseId,
          itemId: params.itemId,
        },
      },
      update: {
        quantity: { increment: params.quantityDelta },
      },
      create: {
        warehouseId: params.warehouseId,
        itemId: params.itemId,
        quantity: params.quantityDelta,
      },
    });
  }

  async recordIncome(op: MovementOperation, tx: Prisma.TransactionClient) {
    // Build idempotency keys
    const txnIdempotencyKey = buildInventoryTransactionIdempotencyKey({
      sourceDocType: op.docType,
      sourceDocId: op.docId,
      operationType: 'IN',
      lineId: op.meta?.lineId as string | undefined,
    });

    // Check for existing transaction
    const existingTxn = await tx.inventoryTransaction.findUnique({
      where: { idempotencyKey: txnIdempotencyKey },
      include: {
        stock_movements_stock_movements_inventoryTransactionIdToinventory_transactions: {
          take: 1,
        },
      },
    });

    if (existingTxn) {
      // Idempotent: return existing transaction
      const existingMovement =
        existingTxn.stock_movements_stock_movements_inventoryTransactionIdToinventory_transactions[0];
      return {
        movementId: existingMovement?.id ?? null,
        transactionId: existingTxn.id,
      };
    }

    const movementIdempotencyKey = buildStockMovementIdempotencyKey({
      sourceDocType: op.docType,
      sourceDocId: op.docId,
      direction: 'IN',
      itemId: op.itemId,
      warehouseId: op.warehouseId,
      lineId: op.meta?.lineId as string | undefined,
    });

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
      idempotencyKey: movementIdempotencyKey,
    });

    let txn;
    try {
      txn = await tx.inventoryTransaction.create({
        data: {
          warehouseId: op.warehouseId,
          itemId: op.itemId,
          quantity: new Prisma.Decimal(op.quantity),
          direction: InventoryDirection.IN,
          docType: op.docType,
          docId: op.docId,
          stockMovementId: income.id,
          idempotencyKey: txnIdempotencyKey,
        },
      });
    } catch (e: any) {
      // Handle race condition: another request created the transaction
      if (e?.code === 'P2002') {
        const again = await tx.inventoryTransaction.findUnique({
          where: { idempotencyKey: txnIdempotencyKey },
          include: {
            stock_movements_stock_movements_inventoryTransactionIdToinventory_transactions: {
              take: 1,
            },
          },
        });
        if (again) {
          const existingMovement =
            again.stock_movements_stock_movements_inventoryTransactionIdToinventory_transactions[0];
          return {
            movementId: existingMovement?.id ?? null,
            transactionId: again.id,
          };
        }
        throw new ConflictException('Duplicate idempotencyKey for InventoryTransaction');
      }
      throw e;
    }

    await tx.stockMovement.update({
      where: { id: income.id },
      data: {
        inventoryTransactionId: txn.id,
        sourceDocType: op.sourceDocType ?? null,
        sourceDocId: op.sourceDocId ?? null,
      },
    });

    await this.adjustBalanceWithTx(tx, {
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
      batchId: income.batchId ?? null,
      sourceDocType: op.sourceDocType ?? AccountingDocType.OTHER,
      sourceDocId: op.sourceDocId ?? op.docId,
      docType: op.docType,
      docId: op.docId,
      inventoryTransactionId: txn.id,
      eventVersion: 1,
    });

    return { movementId: income.id, transactionId: txn.id };
  }

  async recordOutcome(
    op: MovementOperation,
    tx: Prisma.TransactionClient,
  ): Promise<InventoryOutcomeResult> {
    // Build idempotency key for transaction
    const txnIdempotencyKey = buildInventoryTransactionIdempotencyKey({
      sourceDocType: op.docType,
      sourceDocId: op.docId,
      operationType: 'OUT',
      lineId: op.meta?.lineId as string | undefined,
    });

    // Check for existing transaction
    const existingTxn = await tx.inventoryTransaction.findUnique({
      where: { idempotencyKey: txnIdempotencyKey },
    });

    if (existingTxn) {
      // Idempotent: return existing transaction
      const baseCurrency = getBaseCurrency();
      const movements = await tx.stockMovement.findMany({
        where: { inventoryTransactionId: existingTxn.id } as any,
      });
      const totalCostBase = await this.computeTotalCostBaseFromMovements(
        tx,
        movements,
      );
      return {
        movementIds: movements.map((m) => m.id),
        movements,
        transactionId: existingTxn.id,
        totalCost: totalCostBase,
        totalCostBase,
        currency: baseCurrency,
        baseCurrency,
      };
    }

    const outcome = await this.fifo.recordOutcome({
      itemId: op.itemId,
      warehouseId: op.warehouseId,
      quantity: op.quantity,
      docType: op.docType,
      docId: op.docId,
      meta: op.meta,
      tx,
      movementType: op.movementType,
      buildIdempotencyKey: (mv, idx, batchId) =>
        buildStockMovementIdempotencyKey({
          sourceDocType: op.docType,
          sourceDocId: op.docId,
          direction: 'OUT',
          itemId: op.itemId,
          warehouseId: op.warehouseId,
          batchId: batchId ?? null,
          partN: idx,
          lineId: op.meta?.lineId as string | undefined,
        }),
    });

    let txn;
    try {
      txn = await tx.inventoryTransaction.create({
        data: {
          warehouseId: op.warehouseId,
          itemId: op.itemId,
          quantity: new Prisma.Decimal(op.quantity),
          direction: InventoryDirection.OUT,
          docType: op.docType,
          docId: op.docId,
          stockMovementId: outcome.movements[0]?.id ?? null,
          idempotencyKey: txnIdempotencyKey,
        },
      });
    } catch (e: any) {
      // Handle race condition: another request created the transaction
      if (e?.code === 'P2002') {
        const again = await tx.inventoryTransaction.findUnique({
          where: { idempotencyKey: txnIdempotencyKey },
        });
        if (again) {
          const movements = await tx.stockMovement.findMany({
            where: { inventoryTransactionId: again.id } as any,
          });
          const baseCurrency = getBaseCurrency();
          const totalCostBase = await this.computeTotalCostBaseFromMovements(
            tx,
            movements,
          );
          return {
            movementIds: movements.map((m) => m.id),
            movements,
            transactionId: again.id,
            totalCost: totalCostBase,
            totalCostBase,
            currency: baseCurrency,
            baseCurrency,
          };
        }
        throw new ConflictException('Duplicate idempotencyKey for InventoryTransaction');
      }
      throw e;
    }

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

    await this.adjustBalanceWithTx(tx, {
      warehouseId: op.warehouseId,
      itemId: op.itemId,
      quantityDelta: -Number(op.quantity),
    });

    // Emit STOCK_CHANGED event for each movement (variant A)
    // Each event has the same inventoryTransactionId as correlationId
    for (const mv of outcome.movements) {
      const qtyDelta =
        mv.quantity !== undefined && mv.quantity !== null
          ? Number(mv.quantity) // Already negative for OUT
          : -Number(op.quantity);

      await this.inventoryEvents.emitStockChanged(tx, {
        warehouseId: op.warehouseId,
        itemId: op.itemId,
        qtyDelta: qtyDelta,
        movementType: op.movementType,
        movementId: mv.id,
        batchId: mv.batchId ?? null,
        sourceDocType: op.sourceDocType ?? AccountingDocType.OTHER,
        sourceDocId: op.sourceDocId ?? op.docId,
        docType: op.docType,
        docId: op.docId,
        inventoryTransactionId: txn.id,
        eventVersion: 1,
      });
    }

    return {
      movementIds: outcome.movements.map((m) => m.id),
      movements: outcome.movements,
      transactionId: txn.id,
      totalCost: outcome.totalCost,
      totalCostBase: outcome.totalCostBase,
      currency: outcome.currency,
      baseCurrency: outcome.baseCurrency,
    };
  }
}
