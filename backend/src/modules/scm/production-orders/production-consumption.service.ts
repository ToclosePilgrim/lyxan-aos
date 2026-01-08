import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingDocType,
  Prisma,
  ProductionConsumptionStatus,
  ProductionOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryService } from '../../finance/accounting-entry/accounting-entry.service';
import { ACCOUNTING_ACCOUNTS } from '../../finance/accounting-accounts.config';
import { PostingRunsService } from '../../finance/posting-runs/posting-runs.service';
import { InventoryAccountingLinkWriterService } from '../../inventory/inventory-accounting-link-writer.service';
import {
  FifoInventoryService,
  InsufficientStockException,
} from '../../inventory/fifo.service';
import { InventoryOrchestratorService } from '../../inventory/inventory-orchestrator.service';
import {
  InventoryAccountingLinkRole,
  InventoryDocumentType,
  InventoryMovementType,
} from '../../inventory/inventory.enums';
import { StockReservationService } from '../../inventory/stock-reservation.service';
import { MdmItemsService } from '../../mdm/items/mdm-items.service';
import { getBaseCurrency } from '../../finance/constants';
import crypto from 'node:crypto';

type Decimalish = Prisma.Decimal | number | string;

interface ConsumeArgs {
  orderId: string;
  itemId: string;
  quantity: Decimalish;
  responsibleUserId?: string | null;
  note?: string | null;
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class ProductionConsumptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fifo: FifoInventoryService,
    private readonly stockReservations: StockReservationService,
    private readonly inventoryOrchestrator: InventoryOrchestratorService,
    private readonly mdmItems: MdmItemsService,
    private readonly accountingEntries: AccountingEntryService,
    private readonly inventoryAccountingLinkWriter: InventoryAccountingLinkWriterService,
    private readonly postingRuns: PostingRunsService,
  ) {}

  private toDecimal(value: Decimalish) {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }

  private getConsumptionStatus(
    planned: Prisma.Decimal,
    consumed: Prisma.Decimal,
  ) {
    if (consumed.lte(0)) {
      return ProductionConsumptionStatus.NOT_CONSUMED;
    }
    if (consumed.lt(planned)) {
      return ProductionConsumptionStatus.PARTIALLY_CONSUMED;
    }
    if (consumed.equals(planned)) {
      return ProductionConsumptionStatus.CONSUMED;
    }
    return ProductionConsumptionStatus.PARTIALLY_CONSUMED;
  }

  async consume(args: ConsumeArgs) {
    const runner = async (client: Prisma.TransactionClient) => {
      const order = await client.productionOrder.findUnique({
        where: { id: args.orderId },
        include: {
          ScmProduct: { select: { brandId: true } },
          warehouses_production_orders_warehouseIdTowarehouses: {
            select: { countryId: true },
          },
        },
      });
      if (!order) {
        throw new NotFoundException(
          `Production order with ID ${args.orderId} not found`,
        );
      }
      if (
        order.status === ProductionOrderStatus.COMPLETED ||
        order.status === ProductionOrderStatus.CANCELLED
      ) {
        throw new ConflictException(
          `Production order is not in a state that allows consumption (status=${order.status})`,
        );
      }
      if (order.status !== ProductionOrderStatus.IN_PROGRESS) {
        throw new BadRequestException(
          `Production order is not in a state that allows consumption (status=${order.status})`,
        );
      }

      const item = await client.productionOrderItem.findUnique({
        where: { id: args.itemId },
      });
      if (!item || item.productionOrderId !== args.orderId) {
        throw new BadRequestException(
          'Component not found in this production order',
        );
      }

      const qtyDec = this.toDecimal(args.quantity);
      if (qtyDec.lte(0)) {
        throw new BadRequestException('Quantity must be greater than zero');
      }

      const planned = this.toDecimal(item.quantityPlanned as any);
      const consumedDec = this.toDecimal(item.consumedQty);
      const remaining = planned.sub(consumedDec);
      if (qtyDec.gt(remaining)) {
        throw new BadRequestException(
          `Cannot consume more than planned. Remaining: ${remaining.toString()}, requested: ${qtyDec.toString()}`,
        );
      }

      const warehouseId = item.sourceWarehouseId || order.warehouseId || null;
      if (!warehouseId) {
        throw new BadRequestException(
          'Source warehouse is required for consumption',
        );
      }

      const operation = await client.productionConsumptionOperation.create({
        data: {
          id: crypto.randomUUID(),
          productionOrderId: args.orderId,
          productionOrderItemId: args.itemId,
          quantity: qtyDec,
          responsibleUserId: args.responsibleUserId ?? null,
          note: args.note ?? null,
        },
      });

      const mdmItemId = item.itemId;
      if (!mdmItemId) {
        throw new BadRequestException(
          'productionOrderItem.itemId is required (MDM-08)',
        );
      }

      let outcome: {
        movementIds: string[];
        transactionId: string;
        totalCost: Prisma.Decimal;
        totalCostBase: Prisma.Decimal;
        currency: string;
        baseCurrency: string;
      };

      try {
        outcome = await this.inventoryOrchestrator.recordOutcome(
          {
            itemId: mdmItemId,
            warehouseId,
            quantity: qtyDec,
            docType: InventoryDocumentType.PRODUCTION_INPUT,
            docId: args.orderId,
            movementType: InventoryMovementType.OUTCOME,
            meta: {
              productionOrderId: args.orderId,
              productionOrderItemId: item.id,
              consumptionOperationId: operation.id,
              lineId: operation.id, // For idempotency key generation (consumptionOperationId)
            },
          },
          client,
        );
      } catch (e) {
        if (e instanceof InsufficientStockException) {
          throw new ConflictException(
            `Insufficient stock for item ${args.itemId}. Available=${(e as any).availableQty?.toString?.() ?? (e as any).availableQty}, requested=${(e as any).requestedQty?.toString?.() ?? (e as any).requestedQty}`,
          );
        }
        throw e;
      }

      const brandId = order.ScmProduct?.brandId ?? null;
      const countryId =
        order.warehouses_production_orders_warehouseIdTowarehouses?.countryId ??
        null;
      if (!brandId || !countryId) {
        throw new BadRequestException(
          'Cannot post PRODUCTION_CONSUMPTION: brandId/countryId not found for order',
        );
      }
      const bc = await client.brandCountry.findUnique({
        where: { brandId_countryId: { brandId, countryId } } as any,
        select: { legalEntityId: true },
      });
      const legalEntityId = (bc as any)?.legalEntityId ?? null;
      if (!legalEntityId) {
        throw new BadRequestException(
          'Cannot post PRODUCTION_CONSUMPTION: BrandCountry.legalEntityId is not configured',
        );
      }

      const run = await this.postingRuns.getOrCreatePostedRun({
        tx: client,
        legalEntityId,
        docType: AccountingDocType.PRODUCTION_CONSUMPTION,
        docId: outcome.transactionId,
      });

      const existingEntries = await client.accountingEntry.findMany({
        where: { postingRunId: run.id } as any,
        orderBy: [{ lineNumber: 'asc' }],
      });

      // 1) Create AccountingEntry (idempotent by docLineId) and ensure postingRunId is attached
      const entry =
        existingEntries[0] ??
        (await this.accountingEntries.createEntry({
          tx: client,
          docType: AccountingDocType.PRODUCTION_CONSUMPTION,
          docId: outcome.transactionId,
          sourceDocType: AccountingDocType.OTHER,
          sourceDocId: args.orderId,
          // explicit scope
          brandId: brandId ?? undefined,
          countryId: countryId ?? undefined,
          warehouseId,
          lineNumber: 1,
          postingDate: new Date(),
          debitAccount: ACCOUNTING_ACCOUNTS.WIP_PRODUCTION,
          creditAccount: ACCOUNTING_ACCOUNTS.INVENTORY_MATERIALS,
          // TZ 8: never sum mixed currencies "as-is" — post inventory/COGS in base currency.
          amount: outcome.totalCostBase,
          currency: outcome.baseCurrency,
          description: `Production consumption for order ${args.orderId}`,
          metadata: {
            docLineId: `production_consumption:${outcome.transactionId}:materials`,
            productionOrderId: args.orderId,
            productionOrderItemId: item.id,
            itemId: mdmItemId,
            inventoryTransactionId: outcome.transactionId,
            baseCurrency: outcome.baseCurrency,
            totalCostBase: outcome.totalCostBase.toString(),
          },
          postingRunId: run.id,
        }));

      // 2) Link movements в†” entry
      await this.inventoryAccountingLinkWriter.link({
        tx: client,
        movementIds: outcome.movementIds ?? [],
        entryIds: [entry.id],
        role: InventoryAccountingLinkRole.PRODUCTION_INPUT,
      });

      // reservations + update item status
      await this.stockReservations.decreaseReservationForProductionConsumption(
        {
          productionOrderId: args.orderId,
          itemId: mdmItemId,
          warehouseId,
          quantity: qtyDec,
        },
        client,
      );

      const newConsumed = consumedDec.add(qtyDec);
      const newStatus = this.getConsumptionStatus(planned, newConsumed);

      await client.productionOrderItem.update({
        where: { id: item.id },
        data: {
          consumedQty: newConsumed,
          consumptionStatus: newStatus,
          isConsumed: newStatus === ProductionConsumptionStatus.CONSUMED,
        },
      });

      return {
        operationId: operation.id,
        productionOrderItemId: item.id,
        quantity: qtyDec.toNumber(),
        newConsumedQty: newConsumed.toNumber(),
        consumptionStatus: newStatus,
      };
    };

    if (args.tx) {
      return runner(args.tx);
    }
    return this.prisma.$transaction(runner);
  }

  async autoConsumeRemaining(
    orderId: string,
    responsibleUserId?: string | null,
  ) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: { ProductionOrderItem: true },
    });
    if (!order) {
      throw new NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    if (order.status !== ProductionOrderStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Production order is not in a state that allows consumption (status=${order.status})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const refreshed = await tx.productionOrder.findUnique({
        where: { id: orderId },
        include: { ProductionOrderItem: true },
      });
      const items = refreshed?.ProductionOrderItem ?? [];

      const ops: any[] = [];
      for (const it of items) {
        if (it.sourceType !== 'OWN_STOCK') continue;
        const planned = this.toDecimal(it.quantityPlanned);
        const consumed = this.toDecimal(it.consumedQty);
        const remaining = planned.sub(consumed);
        if (remaining.lte(0)) continue;
        ops.push(
          await this.consume({
            orderId,
            itemId: it.id,
            quantity: remaining,
            note: 'Auto-consume remaining',
            responsibleUserId: responsibleUserId ?? null,
            tx,
          }),
        );
      }
      return { orderId, operations: ops };
    });
  }

  async getHistory(orderId: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!order) {
      throw new NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }

    const ops = await this.prisma.productionConsumptionOperation.findMany({
      where: { productionOrderId: orderId },
      orderBy: { createdAt: 'asc' },
      include: {
        ProductionOrderItem: {
          include: {
            item: { select: { id: true, code: true, name: true, unit: true } },
          },
        },
      },
    });

    return ops.map((op) => ({
      id: op.id,
      createdAt: op.createdAt,
      productionOrderId: op.productionOrderId,
      productionOrderItemId: op.productionOrderItemId,
      quantity: op.quantity.toNumber(),
      responsibleUserId: op.responsibleUserId,
      note: op.note,
      item: op.ProductionOrderItem?.item ?? null,
    }));
  }

  private async resolveProductionLegalEntity(params: {
    tx: Prisma.TransactionClient;
    orderId: string;
  }): Promise<{ legalEntityId: string; brandId: string; countryId: string }> {
    const order = await params.tx.productionOrder.findUnique({
      where: { id: params.orderId },
      include: {
        ScmProduct: { select: { brandId: true } },
        warehouses_production_orders_warehouseIdTowarehouses: {
          select: { countryId: true },
        },
      },
    });
    const brandId = order?.ScmProduct?.brandId ?? null;
    const countryId =
      order?.warehouses_production_orders_warehouseIdTowarehouses?.countryId ??
      null;
    if (!brandId || !countryId) {
      throw new BadRequestException(
        'Cannot resolve LegalEntity for production posting: brandId/countryId not found',
      );
    }
    const bc = await params.tx.brandCountry.findUnique({
      where: { brandId_countryId: { brandId, countryId } } as any,
      select: { legalEntityId: true },
    });
    const legalEntityId = (bc as any)?.legalEntityId ?? null;
    if (!legalEntityId) {
      throw new BadRequestException(
        'Cannot resolve LegalEntity for production posting: BrandCountry.legalEntityId is not configured',
      );
    }
    return { legalEntityId, brandId, countryId };
  }

  async voidConsumptionPosting(inventoryTransactionId: string, reason: string) {
    const reasonText = (reason ?? '').trim() || 'void';
    return this.prisma.$transaction(async (tx) => {
      const txn = await tx.inventoryTransaction.findUnique({
        where: { id: inventoryTransactionId },
      });
      if (!txn) throw new NotFoundException('InventoryTransaction not found');
      if ((txn as any).docType !== InventoryDocumentType.PRODUCTION_INPUT) {
        throw new BadRequestException(
          'InventoryTransaction is not a PRODUCTION_INPUT',
        );
      }
      const orderId = (txn as any).docId as string | null;
      if (!orderId)
        throw new BadRequestException(
          'InventoryTransaction.docId (orderId) is required',
        );

      const order = await tx.productionOrder.findUnique({
        where: { id: orderId },
        select: { id: true, status: true },
      });
      if (!order) throw new NotFoundException('ProductionOrder not found');
      if (order.status === ProductionOrderStatus.COMPLETED) {
        throw new ConflictException(
          'Cannot void production consumption: order is COMPLETED',
        );
      }

      const { legalEntityId } = await this.resolveProductionLegalEntity({
        tx,
        orderId,
      });

      // Guard: if completion posting exists, don't allow voiding consumption
      const completionEntry = await tx.accountingEntry.findFirst({
        where: {
          docType: AccountingDocType.PRODUCTION_COMPLETION,
          docId: orderId,
        } as any,
        select: { id: true },
      });
      if (completionEntry) {
        throw new ConflictException(
          'Cannot void production consumption: completion posting exists for this order',
        );
      }

      // Idempotency: already voided
      const voidedOriginal = await (tx as any).accountingPostingRun.findFirst({
        where: {
          legalEntityId,
          docType: AccountingDocType.PRODUCTION_CONSUMPTION,
          docId: inventoryTransactionId,
          status: 'VOIDED',
          reversalRunId: { not: null },
        } as any,
        orderBy: [{ version: 'desc' }],
        select: { id: true, reversalRunId: true },
      });
      if (voidedOriginal?.reversalRunId) {
        await tx.inventoryTransaction.update({
          where: { id: inventoryTransactionId },
          data: {
            voidedAt: (txn as any).voidedAt ?? new Date(),
            voidReason: (txn as any).voidReason ?? reasonText,
          } as any,
        });
        return {
          inventoryTransactionId,
          alreadyVoided: true,
          originalRunId: voidedOriginal.id,
          reversalRunId: voidedOriginal.reversalRunId,
        };
      }

      const run = await this.postingRuns.getActivePostedRun({
        tx,
        legalEntityId,
        docType: AccountingDocType.PRODUCTION_CONSUMPTION,
        docId: inventoryTransactionId,
      });
      if (!run) {
        throw new ConflictException(
          'No active PostingRun found for production consumption',
        );
      }

      const res = await this.postingRuns.voidRun({
        tx,
        runId: run.id,
        reason: reasonText,
      });

      await tx.inventoryTransaction.update({
        where: { id: inventoryTransactionId },
        data: { voidedAt: new Date(), voidReason: reasonText } as any,
      });

      return {
        inventoryTransactionId,
        alreadyVoided: false,
        originalRunId: run.id,
        reversalRunId: (res as any).reversalRun?.id ?? null,
      };
    });
  }

  async repostConsumptionPosting(
    inventoryTransactionId: string,
    reason: string,
  ) {
    const reasonText = (reason ?? '').trim() || 'repost';
    return this.prisma.$transaction(async (tx) => {
      const txn = await tx.inventoryTransaction.findUnique({
        where: { id: inventoryTransactionId },
      });
      if (!txn) throw new NotFoundException('InventoryTransaction not found');
      if ((txn as any).docType !== InventoryDocumentType.PRODUCTION_INPUT) {
        throw new BadRequestException(
          'InventoryTransaction is not a PRODUCTION_INPUT',
        );
      }
      const orderId = (txn as any).docId as string | null;
      if (!orderId)
        throw new BadRequestException(
          'InventoryTransaction.docId (orderId) is required',
        );

      const order = await tx.productionOrder.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, warehouseId: true },
      });
      if (!order) throw new NotFoundException('ProductionOrder not found');
      if (order.status === ProductionOrderStatus.COMPLETED) {
        throw new ConflictException(
          'Cannot repost production consumption: order is COMPLETED',
        );
      }

      const { legalEntityId, brandId, countryId } =
        await this.resolveProductionLegalEntity({
          tx,
          orderId,
        });

      // If there is an active business run (not voided yet), void it first.
      const voidedOriginal = await (tx as any).accountingPostingRun.findFirst({
        where: {
          legalEntityId,
          docType: AccountingDocType.PRODUCTION_CONSUMPTION,
          docId: inventoryTransactionId,
          status: 'VOIDED',
          reversalRunId: { not: null },
        } as any,
        orderBy: [{ version: 'desc' }],
        select: { id: true },
      });

      const activeRun = voidedOriginal
        ? null
        : await this.postingRuns.getActivePostedRun({
            tx,
            legalEntityId,
            docType: AccountingDocType.PRODUCTION_CONSUMPTION,
            docId: inventoryTransactionId,
          });

      if (activeRun) {
        await this.postingRuns.voidRun({
          tx,
          runId: activeRun.id,
          reason: reasonText,
        });
      }

      const repostRun = await this.postingRuns.createNextRun({
        tx,
        legalEntityId,
        docType: AccountingDocType.PRODUCTION_CONSUMPTION,
        docId: inventoryTransactionId,
        repostedFromRunId: activeRun?.id ?? voidedOriginal?.id ?? null,
      });

      const movements = await tx.stockMovement.findMany({
        where: { inventoryTransactionId } as any,
        select: {
          id: true,
          quantity: true,
          batchId: true,
          meta: true,
          StockBatche: { select: { unitCostBase: true } },
        },
      });
      if (!movements.length) {
        throw new BadRequestException(
          'No stock movements found for this inventoryTransactionId',
        );
      }
      const baseCurrency = getBaseCurrency();
      let totalBase = new Prisma.Decimal(0);
      for (const mv of movements as any[]) {
        const qty = new Prisma.Decimal(mv.quantity).abs();
        const metaLineCostBase =
          mv.meta && typeof mv.meta.lineCostBase === 'string'
            ? new Prisma.Decimal(mv.meta.lineCostBase)
            : null;
        if (metaLineCostBase) {
          totalBase = totalBase.add(metaLineCostBase);
          continue;
        }
        const unitCostBase =
          mv.StockBatche?.unitCostBase !== null &&
          mv.StockBatche?.unitCostBase !== undefined
            ? new Prisma.Decimal(mv.StockBatche.unitCostBase)
            : null;
        if (unitCostBase) {
          totalBase = totalBase.add(qty.mul(unitCostBase));
        }
      }
      if (totalBase.lte(0))
        throw new BadRequestException('Computed repost amount must be > 0');

      const docLineId =
        repostRun.version === 1
          ? `production_consumption:${inventoryTransactionId}:materials`
          : `production_consumption:${inventoryTransactionId}:materials:v${repostRun.version}`;

      const entry = await this.accountingEntries.createEntry({
        tx,
        docType: AccountingDocType.PRODUCTION_CONSUMPTION,
        docId: inventoryTransactionId,
        sourceDocType: AccountingDocType.OTHER,
        sourceDocId: orderId,
        brandId: brandId ?? undefined,
        countryId: countryId ?? undefined,
        warehouseId: (txn as any).warehouseId ?? undefined,
        lineNumber: 1,
        postingDate: new Date(),
        debitAccount: ACCOUNTING_ACCOUNTS.WIP_PRODUCTION,
        creditAccount: ACCOUNTING_ACCOUNTS.INVENTORY_MATERIALS,
        // TZ 8: repost in base currency only
        amount: totalBase,
        currency: baseCurrency,
        description: `Production consumption repost for order ${orderId}`,
        metadata: {
          docLineId,
          productionOrderId: orderId,
          inventoryTransactionId,
          baseCurrency,
          totalCostBase: totalBase.toString(),
        },
        postingRunId: repostRun.id,
      });

      await this.inventoryAccountingLinkWriter.link({
        tx,
        movementIds: movements.map((m) => m.id),
        entryIds: [entry.id],
        role: InventoryAccountingLinkRole.PRODUCTION_INPUT,
      });

      await tx.inventoryTransaction.update({
        where: { id: inventoryTransactionId },
        data: { voidedAt: null, voidReason: null } as any,
      });

      return {
        inventoryTransactionId,
        postingRunId: repostRun.id,
        version: repostRun.version,
        entryId: entry.id,
      };
    });
  }
}
