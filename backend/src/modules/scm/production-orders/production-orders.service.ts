import * as common_1 from '@nestjs/common';
import * as client_1 from '@prisma/client';
import * as library_1 from '@prisma/client/runtime/library';
import * as accounting_accounts_config_1 from '../../finance/accounting-accounts.config';
import * as inventory_enums_1 from '../../inventory/inventory.enums';
import * as update_production_order_component_source_dto_1 from './dto/update-production-order-component-source.dto';

import { PrismaService } from '../../../database/prisma.service';
import { FifoInventoryService } from '../../inventory/fifo.service';
import { ProvisioningRecalcService } from './provisioning-recalc.service';
import { FinancialDocumentsService } from '../../finance/documents/financial-documents.service';
import { ProductionConsumptionService } from './production-consumption.service';
import { StockReservationService } from '../../inventory/stock-reservation.service';
import { InventoryOrchestratorService } from '../../inventory/inventory-orchestrator.service';
import { OverheadRulesService } from '../../finance/overhead-rules/overhead-rules.service';
import { CurrencyRateService } from '../../finance/currency-rates/currency-rate.service';
import { AccountingEntryService } from '../../finance/accounting-entry/accounting-entry.service';
import { PostingRunsService } from '../../finance/posting-runs/posting-runs.service';
import { MdmItemsService } from '../../mdm/items/mdm-items.service';
import { InventoryAccountingLinkWriterService } from '../../inventory/inventory-accounting-link-writer.service';
const ProvisionStatus = client_1.ScmComponentProvisionStatus;
const SupplyStatus = client_1.ScmSupplyStatus;
const TransferStatus = client_1.ScmTransferStatus;
const ConsumptionStatus = client_1.ProductionConsumptionStatus;
@common_1.Injectable()
export class ProductionOrdersService {
  prisma;
  fifo;
  inventoryOrchestrator;
  mdmItems;
  provisioningRecalc;
  financialDocuments;
  consumptionService;
  overheadRules;
  currencyRates;
  accountingEntries;
  stockReservationService;
  postingRuns;
  inventoryAccountingLinkWriter;
  constructor(
    prisma: PrismaService,
    fifo: FifoInventoryService,
    inventoryOrchestrator: InventoryOrchestratorService,
    mdmItems: MdmItemsService,
    provisioningRecalc: ProvisioningRecalcService,
    financialDocuments: FinancialDocumentsService,
    consumptionService: ProductionConsumptionService,
    overheadRules: OverheadRulesService,
    currencyRates: CurrencyRateService,
    accountingEntries: AccountingEntryService,
    stockReservationService: StockReservationService,
    postingRuns: PostingRunsService,
    inventoryAccountingLinkWriter: InventoryAccountingLinkWriterService,
  ) {
    this.prisma = prisma;
    this.fifo = fifo;
    this.inventoryOrchestrator = inventoryOrchestrator;
    this.mdmItems = mdmItems;
    this.provisioningRecalc = provisioningRecalc;
    this.financialDocuments = financialDocuments;
    this.consumptionService = consumptionService;
    this.overheadRules = overheadRules;
    this.currencyRates = currencyRates;
    this.accountingEntries = accountingEntries;
    this.stockReservationService = stockReservationService;
    this.postingRuns = postingRuns;
    this.inventoryAccountingLinkWriter = inventoryAccountingLinkWriter;
  }
  async generateOrderCode() {
    const year = new Date().getFullYear();
    const prefix = `PR-${year}-`;
    const latest = await this.prisma.productionOrder.findFirst({
      where: {
        code: {
          startsWith: prefix,
        },
      },
      orderBy: {
        code: 'desc',
      },
    });
    let sequence = 1;
    if (latest) {
      const lastSequence = parseInt(latest.code.replace(prefix, ''), 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }
    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }
  async startProduction(orderId) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        ProductionOrderItem: true,
        warehouses_production_orders_outputWarehouseIdTowarehouses: {
          select: { id: true, name: true, code: true },
        },
      },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    if (
      order.status !== client_1.ProductionOrderStatus.DRAFT &&
      order.status !== client_1.ProductionOrderStatus.PLANNED
    ) {
      throw new common_1.BadRequestException(
        'Production can only be started from DRAFT/PLANNED status',
      );
    }
    if (!order.outputWarehouseId) {
      throw new common_1.UnprocessableEntityException(
        'Output warehouse must be specified before starting production.',
      );
    }
    const itemsAny: any[] = order?.ProductionOrderItem || [];
    // Provisioning gate (MVP): all OWN_STOCK components must be PROVIDED and have enough provisionedQty.
    const missing: any[] = [];
    for (const it of itemsAny) {
      if (it.sourceType !== 'OWN_STOCK') continue;
      const planned = new client_1.Prisma.Decimal(it.quantityPlanned);
      const alreadyConsumed = new client_1.Prisma.Decimal(
        it.consumedQty?.toNumber?.() ?? it.consumedQty ?? 0,
      );
      const required = planned.sub(alreadyConsumed);
      if (required.lte(0)) continue;
      const provisioned = new client_1.Prisma.Decimal(
        it.provisionedQty?.toNumber?.() ?? it.provisionedQty ?? 0,
      );
      if (
        it.provisionStatus !== client_1.ScmComponentProvisionStatus.PROVIDED ||
        provisioned.lt(required) ||
        !(it.provisionedWarehouseId || it.sourceWarehouseId)
      ) {
        missing.push({
          productionOrderItemId: it.id,
          itemId: it.itemId,
          requiredQty: required.toNumber(),
          provisionedQty: provisioned.toNumber(),
          provisionStatus: it.provisionStatus,
        });
      }
    }
    if (missing.length > 0) {
      throw new common_1.ConflictException({
        message:
          'Cannot start production: components are not fully provisioned',
        missing,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.productionOrder.update({
        where: { id: orderId },
        data: {
          status: client_1.ProductionOrderStatus.IN_PROGRESS,
        },
      });
      for (const item of itemsAny) {
        if (item.sourceType !== 'OWN_STOCK') {
          continue;
        }
        const planned = new client_1.Prisma.Decimal(item.quantityPlanned);
        const alreadyConsumed = new client_1.Prisma.Decimal(
          item.consumedQty?.toNumber?.() ?? item.consumedQty ?? 0,
        );
        const remaining = planned.sub(alreadyConsumed);
        if (remaining.lte(0)) {
          continue;
        }
        await this.consumptionService.consume({
          orderId,
          itemId: item.id,
          quantity: remaining,
          note: 'Auto consumption on start',
          tx,
        });
      }
    });
    return { success: true };
  }

  async provisionItem(orderId, itemId, dto) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, warehouseId: true },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    const item = await this.prisma.productionOrderItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.productionOrderId !== orderId) {
      throw new common_1.NotFoundException(
        `Production order item with ID ${itemId} not found in order ${orderId}`,
      );
    }
    if (item.sourceType !== 'OWN_STOCK') {
      throw new common_1.UnprocessableEntityException(
        'Provisioning MVP supports only OWN_STOCK components',
      );
    }
    const amountDec = new client_1.Prisma.Decimal(dto.amount);
    if (amountDec.lte(0)) {
      throw new common_1.BadRequestException(
        'amount must be greater than zero',
      );
    }
    // Idempotency: if already PROVIDED with same warehouse + amount -> OK
    const currentProvisioned = new client_1.Prisma.Decimal(
      item.provisionedQty?.toNumber?.() ?? item.provisionedQty ?? 0,
    );
    const currentWh =
      item.provisionedWarehouseId || item.sourceWarehouseId || null;
    if (
      item.provisionStatus === client_1.ScmComponentProvisionStatus.PROVIDED &&
      currentWh === dto.warehouseId &&
      currentProvisioned.equals(amountDec)
    ) {
      return {
        success: true,
        itemId: item.id,
        provisionStatus: item.provisionStatus,
      };
    }
    if (
      item.provisionStatus === client_1.ScmComponentProvisionStatus.PROVIDED &&
      (currentWh !== dto.warehouseId || !currentProvisioned.equals(amountDec))
    ) {
      throw new common_1.ConflictException(
        'Already provisioned; use unprovision first',
      );
    }
    // Stock validation (minimal): inventoryBalance.quantity >= amount
    if (!dto.allowNegativeStock) {
      const stock = await (this.prisma as any).inventoryBalance.findUnique({
        where: {
          warehouseId_itemId: {
            warehouseId: dto.warehouseId,
            itemId: item.itemId,
          },
        },
        select: { quantity: true },
      });
      const available = stock?.quantity
        ? new client_1.Prisma.Decimal(stock.quantity)
        : new client_1.Prisma.Decimal(0);
      if (available.lt(amountDec)) {
        throw new common_1.ConflictException({
          message: 'Insufficient stock',
          available: available.toNumber(),
          requested: amountDec.toNumber(),
          warehouseId: dto.warehouseId,
          mdmItemId: item.itemId,
        });
      }
    }
    const planned = new client_1.Prisma.Decimal(item.quantityPlanned);
    const alreadyConsumed = new client_1.Prisma.Decimal(
      item.consumedQty?.toNumber?.() ?? item.consumedQty ?? 0,
    );
    const required = planned.sub(alreadyConsumed);
    const newStatus = amountDec.gte(required)
      ? client_1.ScmComponentProvisionStatus.PROVIDED
      : client_1.ScmComponentProvisionStatus.PARTIALLY_PROVIDED;
    await this.prisma.productionOrderItem.update({
      where: { id: item.id },
      data: {
        provisionStatus: newStatus,
        provisionedQty: amountDec,
        sourceWarehouseId: dto.warehouseId,
        provisionedWarehouseId: dto.warehouseId,
        provisionedAt: new Date(),
        provisionMeta: {
          sourceType: dto.sourceType,
          amount: amountDec.toString(),
          note: dto.note ?? null,
        },
      },
    });
    return { success: true, itemId: item.id, provisionStatus: newStatus };
  }

  async unprovisionItem(orderId, itemId) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    if (
      order.status === client_1.ProductionOrderStatus.IN_PROGRESS ||
      order.status === client_1.ProductionOrderStatus.COMPLETED
    ) {
      throw new common_1.ConflictException(
        'Cannot unprovision: production already started',
      );
    }
    const item = await this.prisma.productionOrderItem.findUnique({
      where: { id: itemId },
      select: { id: true, productionOrderId: true },
    });
    if (!item || item.productionOrderId !== orderId) {
      throw new common_1.NotFoundException(
        `Production order item with ID ${itemId} not found in order ${orderId}`,
      );
    }
    const consumedOps = await this.prisma.productionConsumptionOperation.count({
      where: { productionOrderId: orderId, productionOrderItemId: itemId },
    });
    if (consumedOps > 0) {
      throw new common_1.ConflictException(
        'Cannot unprovision: consumption already started',
      );
    }
    await this.prisma.productionOrderItem.update({
      where: { id: itemId },
      data: {
        provisionStatus: client_1.ScmComponentProvisionStatus.NOT_PROVIDED,
        provisionedQty: new client_1.Prisma.Decimal(0),
        provisionedAt: null,
        provisionedWarehouseId: null,
        sourceWarehouseId: null,
        provisionMeta: null,
      },
    });
    return { success: true, itemId };
  }
  async consumeComponents(orderId, dto) {
    if (!dto.items || dto.items.length === 0) {
      throw new common_1.BadRequestException('Items array is required');
    }
    const results: any[] = [];
    for (const input of dto.items) {
      const op = await this.consumptionService.consume({
        orderId,
        itemId: input.productionOrderItemId,
        quantity: input.quantity,
        note: 'Batch consumption',
      });
      const planned = await this.prisma.productionOrderItem.findUnique({
        where: { id: input.productionOrderItemId },
        select: { quantityPlanned: true, consumedQty: true },
      });
      const plannedDec = planned
        ? new client_1.Prisma.Decimal(planned.quantityPlanned)
        : null;
      const consumedDec = planned
        ? new client_1.Prisma.Decimal(
            planned.consumedQty?.toNumber?.() ?? planned.consumedQty ?? 0,
          )
        : null;
      results.push({
        productionOrderItemId: op.productionOrderItemId,
        requestedQuantity: input.quantity,
        newConsumedQty: op.newConsumedQty,
        remainingToConsume:
          plannedDec && consumedDec
            ? plannedDec.sub(consumedDec).toNumber()
            : undefined,
        consumptionStatus: op.consumptionStatus,
        operationId: op.operationId,
      });
    }
    return {
      orderId,
      items: results,
    };
  }
  async sumProductionInputMovements(orderId, itemId) {
    const agg = await this.prisma.stockMovement.aggregate({
      where: {
        docType: 'PRODUCTION_INPUT',
        docId: orderId,
        itemId,
      },
      _sum: { quantity: true },
    });
    const q = agg._sum.quantity
      ? new client_1.Prisma.Decimal(agg._sum.quantity).abs()
      : new client_1.Prisma.Decimal(0);
    return q;
  }
  getConsumptionStatus(planned, consumed) {
    if (consumed.lte(0)) {
      return ConsumptionStatus?.NOT_CONSUMED ?? 'NOT_CONSUMED';
    }
    if (consumed.lt(planned)) {
      return ConsumptionStatus?.PARTIALLY_CONSUMED ?? 'PARTIALLY_CONSUMED';
    }
    if (consumed.equals(planned)) {
      return ConsumptionStatus?.CONSUMED ?? 'CONSUMED';
    }
    return ConsumptionStatus?.PARTIALLY_CONSUMED ?? 'PARTIALLY_CONSUMED';
  }
  async getConsumptionSummary(orderId) {
    const items = await this.prisma.productionOrderItem.findMany({
      where: { productionOrderId: orderId },
    });
    const summaryItems = items.map((it) => {
      const planned = new client_1.Prisma.Decimal(it.quantityPlanned);
      const consumed = it.consumedQty?.toNumber?.() ?? it.consumedQty ?? 0;
      const consumedDec = new client_1.Prisma.Decimal(consumed);
      const remaining = planned.sub(consumedDec);
      return {
        productionOrderItemId: it.id,
        plannedQty: planned,
        consumedQty: consumedDec,
        remainingToConsume: remaining,
        consumptionStatus: this.getConsumptionStatus(planned, consumedDec),
      };
    });
    const allConsumed = summaryItems.every((i) => i.remainingToConsume.lte(0));
    return {
      orderId,
      items: summaryItems,
      allConsumed,
    };
  }
  async getReservations(orderId) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        ProductionOrderItem: {
          include: {
            item: { select: { id: true, name: true, code: true, unit: true } },
          },
        },
      },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    const desired = new Map();
    for (const it of order.ProductionOrderItem) {
      if (it.sourceType !== 'OWN_STOCK') continue;
      const warehouseId = it.sourceWarehouseId;
      if (!warehouseId) continue;
      const itemId = it.itemId;
      const qty = new client_1.Prisma.Decimal(
        it.quantityPlanned?.toNumber?.() ?? it.quantityPlanned ?? 0,
      );
      if (qty.lte(0)) continue;
      const key = `${itemId}::${warehouseId}`;
      if (!desired.has(key)) {
        desired.set(key, {
          itemId,
          warehouseId,
          requiredQty: new client_1.Prisma.Decimal(0),
          itemName: it.item?.name ?? null,
          itemSku: it.item?.code ?? null,
          componentIds: [],
        });
      }
      const entry = desired.get(key);
      entry.requiredQty = entry.requiredQty.add(qty);
      entry.componentIds.push(it.id);
    }
    const reservations = await this.prisma.stockReservation.findMany({
      where: {
        reservedForType: client_1.StockReservationForType.PRODUCTION_ORDER,
        reservedForId: orderId,
      },
    });
    const now = new Date();
    const reservedMap = new Map();
    for (const r of reservations) {
      const key = `${r.itemId}::${r.warehouseId}`;
      const expired = r.expiresAt && r.expiresAt <= now;
      if (!reservedMap.has(key)) {
        reservedMap.set(key, {
          reservedQty: new client_1.Prisma.Decimal(0),
          hasExpired: true,
        });
      }
      const entry = reservedMap.get(key);
      if (!expired) {
        entry.reservedQty = entry.reservedQty.add(
          new client_1.Prisma.Decimal(r.quantity),
        );
      }
      entry.hasExpired = entry.hasExpired && !!expired;
    }
    const whIds = Array.from(desired.values()).map((d) => d.warehouseId);
    const itemIds = Array.from(desired.values()).map((d) => d.itemId);
    const [warehouses, itemsInfo] = await Promise.all([
      this.prisma.warehouse.findMany({
        where: { id: { in: Array.from(new Set(whIds)) } },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.mdmItem.findMany({
        where: { id: { in: Array.from(new Set(itemIds)) } },
        select: { id: true, name: true, code: true },
      }),
    ]);
    const whMap = new Map(warehouses.map((w) => [w.id, w]));
    const itemMap = new Map(itemsInfo.map((i) => [i.id, i]));
    const items: any[] = [];
    for (const entry of desired.values()) {
      const key = `${entry.itemId}::${entry.warehouseId}`;
      const reservedInfo = reservedMap.get(key);
      const reservedQty =
        reservedInfo?.reservedQty ?? new client_1.Prisma.Decimal(0);
      const wh = whMap.get(entry.warehouseId);
      const itemInfo = itemMap.get(entry.itemId);
      const availableStock =
        await this.stockReservationService.getAvailableToReserve({
          itemId: entry.itemId,
          warehouseId: entry.warehouseId,
        });
      const onHand = availableStock.add(reservedQty);
      const availableToReserveQty = availableStock;
      let reservationStatus;
      if (reservedQty.lte(0)) {
        reservationStatus = 'NONE';
      } else if (reservedQty.gt(onHand)) {
        reservationStatus = 'OVERBOOKED';
      } else if (reservedQty.gte(entry.requiredQty)) {
        reservationStatus = 'FULL';
      } else {
        reservationStatus = 'PARTIAL';
      }
      items.push({
        itemId: entry.itemId,
        componentIds: entry.componentIds,
        warehouseId: entry.warehouseId,
        itemName: entry.itemName ?? (itemInfo as any)?.name ?? null,
        itemSku: entry.itemSku ?? (itemInfo as any)?.code ?? null,
        warehouseName: (wh as any)?.name ?? null,
        warehouseCode: (wh as any)?.code ?? null,
        requiredQty: entry.requiredQty.toString(),
        reservedQty: reservedQty.toString(),
        onHandQty: onHand.toString(),
        availableToReserveQty: availableToReserveQty.toString(),
        reservationStatus,
        hasExpired: reservedInfo?.hasExpired ?? false,
      });
    }
    return {
      orderId,
      items,
    };
  }
  generateBatchCode(order) {
    const base = order.code || `B-${order.id?.slice?.(-6) ?? 'UNK'}`;
    const now = order.actualEndAt ? new Date(order.actualEndAt) : new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
    return `${base}-${stamp}`;
  }
  async createProductionBatchForOrder(orderId, params, tx) {
    const client = tx || this.prisma;
    const order = await client.productionOrder.findUnique({
      where: { id: orderId },
      select: { id: true, productId: true },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    if (order.productId && order.productId !== params.productId) {
      throw new common_1.BadRequestException(
        'Batch product must match production order product',
      );
    }
    return client.productionBatche.create({
      data: {
        productionOrderId: orderId,
        productId: params.productId,
        batchCode: params.batchCode,
        expirationDate: params.expirationDate ?? null,
        totalQty: new client_1.Prisma.Decimal(params.totalQty),
      },
    });
  }
  async getBatchesByOrder(orderId) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    return this.prisma.productionBatche.findMany({
      where: { productionOrderId: orderId },
      orderBy: { createdAt: 'asc' },
    });
  }
  async ensureOrderEditable(orderId) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    if (order.status !== client_1.ProductionOrderStatus.DRAFT) {
      throw new common_1.BadRequestException({
        message: 'Production order is not editable in current status',
        code: 'PRODUCTION_ORDER_NOT_EDITABLE',
        details: { status: order.status },
      });
    }
  }
  async ensureCanChangeSourceType(params) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: params.orderId },
      select: { status: true },
    });
    if (!order) {
      throw new common_1.NotFoundException('Production order not found');
    }
    if (order.status !== client_1.ProductionOrderStatus.DRAFT) {
      throw new common_1.BadRequestException({
        message:
          'Cannot change component sourceType when order is not in DRAFT status',
        code: 'SOURCE_TYPE_CHANGE_FORBIDDEN_ORDER_STATUS',
        details: { status: order.status },
      });
    }
    const component = await this.prisma.productionOrderItem.findUnique({
      where: { id: params.componentId },
      select: {
        id: true,
        productionOrderId: true,
        sourceType: true,
        plannedSupplyId: true,
        plannedTransferId: true,
      },
    });
    if (!component || component.productionOrderId !== params.orderId) {
      throw new common_1.NotFoundException(
        'Production order component not found',
      );
    }
    if (component.sourceType === params.newSourceType) {
      return;
    }
    const consumptionCount =
      (this.prisma.productionConsumptionOperation &&
        (await this.prisma.productionConsumptionOperation.count({
          where: { productionOrderItemId: params.componentId },
        }))) ||
      0;
    if (consumptionCount > 0) {
      throw new common_1.BadRequestException({
        message: 'Cannot change sourceType after component consumption',
        code: 'SOURCE_TYPE_CHANGE_FORBIDDEN_CONSUMPTION',
        details: { componentId: params.componentId, consumptionCount },
      });
    }
    if (component.plannedSupplyId) {
      const supply = await this.prisma.scmSupply.findUnique({
        where: { id: component.plannedSupplyId },
        select: { status: true },
      });
      if (supply && supply.status !== (SupplyStatus?.DRAFT ?? 'DRAFT')) {
        throw new common_1.BadRequestException({
          message:
            'Cannot change sourceType when supply is already in progress',
          code: 'SOURCE_TYPE_CHANGE_FORBIDDEN_SUPPLY_STATUS',
          details: { supplyStatus: supply.status },
        });
      }
    }
    if (component.plannedTransferId) {
      const transfer = await this.prisma.scmTransfer.findUnique({
        where: { id: component.plannedTransferId },
        select: { status: true },
      });
      if (transfer && transfer.status !== (TransferStatus?.DRAFT ?? 'DRAFT')) {
        throw new common_1.BadRequestException({
          message:
            'Cannot change sourceType when transfer is already in progress',
          code: 'SOURCE_TYPE_CHANGE_FORBIDDEN_TRANSFER_STATUS',
          details: { transferStatus: transfer.status },
        });
      }
    }
  }
  async findAll(filters) {
    const where: any = {};
    if (filters?.status) {
      const statusArray = Array.isArray(filters.status)
        ? filters.status
        : typeof filters.status === 'string'
          ? filters.status.split(',').map((s) => s.trim())
          : [];
      if (statusArray.length > 0) {
        where.status = {
          in: statusArray,
        };
      }
    }
    if (filters?.productId) {
      where.productId = filters.productId;
    }
    const orConditions: any[] = [];
    if (filters?.from || filters?.to) {
      const dateFilter: any = {};
      if (filters.from) {
        dateFilter.gte = new Date(filters.from);
      }
      if (filters.to) {
        dateFilter.lte = new Date(filters.to);
      }
      if (Object.keys(dateFilter).length > 0) {
        orConditions.push(
          { plannedStartAt: dateFilter },
          { createdAt: dateFilter },
        );
      }
    }
    if (filters?.search) {
      orConditions.push(
        {
          code: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          name: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
      );
    }
    if (orConditions.length > 0) {
      where.OR = orConditions;
    }
    const requestedLimit = filters?.limit ? Number(filters.limit) : undefined;
    const limit = requestedLimit ? Math.min(requestedLimit, 100) : undefined;
    const orders = await this.prisma.productionOrder.findMany({
      where,
      include: {
        ScmProduct: {
          select: {
            id: true,
            internalName: true,
            sku: true,
          },
        },
        Country: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        manufacturer: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
    const mappedOrders = orders.map((order) => ({
      id: order.id,
      code: order.code,
      name: order.name,
      productId: order.productId,
      productName: order.ScmProduct.internalName,
      status: order.status,
      quantityPlanned: order.quantityPlanned.toNumber(),
      unit: order.unit,
      plannedStartAt: order.plannedStartAt,
      plannedEndAt: order.plannedEndAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));
    return mappedOrders;
  }
  async findOne(id) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        ScmProduct: {
          select: {
            id: true,
            internalName: true,
            sku: true,
            type: true,
          },
        },
        Country: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        manufacturer: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        warehouses_production_orders_outputWarehouseIdTowarehouses: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        ProductionOrderItem: {
          include: {
            item: {
              select: {
                id: true,
                type: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${id} not found`,
      );
    }
    return {
      order: {
        id: order.id,
        code: order.code,
        name: order.name,
        status: order.status,
        productId: order.productId,
        productName: order.ScmProduct.internalName,
        quantityPlanned: order.quantityPlanned.toNumber(),
        unit: order.unit,
        outputWarehouseId: order.outputWarehouseId,
        outputWarehouse:
          order.warehouses_production_orders_outputWarehouseIdTowarehouses ||
          null,
        producedItemId: order.producedItemId || order.productId,
        producedQty:
          order.producedQty?.toNumber?.() ?? order.producedQty ?? null,
        materialsCostTotal:
          order.materialsCostTotal?.toNumber?.() ??
          order.materialsCostTotal ??
          0,
        servicesCostTotal:
          order.servicesCostTotal?.toNumber?.() ?? order.servicesCostTotal ?? 0,
        totalMaterialCost:
          order.totalMaterialCost?.toNumber?.() ??
          order.totalMaterialCost ??
          order.materialsCostTotal?.toNumber?.() ??
          order.materialsCostTotal ??
          0,
        totalServiceCost:
          order.totalServiceCost?.toNumber?.() ??
          order.totalServiceCost ??
          order.servicesCostTotal?.toNumber?.() ??
          order.servicesCostTotal ??
          0,
        otherCostTotal:
          order.otherCostTotal?.toNumber?.() ?? order.otherCostTotal ?? 0,
        totalCost: order.totalCost?.toNumber?.() ?? order.totalCost ?? 0,
        unitCost: order.unitCost?.toNumber?.() ?? order.unitCost ?? 0,
        currency: order.currency || 'RUB',
        plannedStartAt: order.plannedStartAt,
        plannedEndAt: order.plannedEndAt,
        actualStartAt: order.actualStartAt,
        actualEndAt: order.actualEndAt,
        productionSite: order.productionSite,
        notes: order.notes,
        productionCountryId: order.productionCountryId,
        productionCountry: order.Country,
        manufacturerId: order.manufacturerId,
        manufacturer: order.manufacturer,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      items: order.ProductionOrderItem.map((item) => {
        const plannedUnitCost =
          item.plannedUnitCost?.toNumber?.() ?? item.plannedUnitCost ?? 0;
        const plannedTotalCost =
          item.plannedTotalCost?.toNumber?.() ?? item.plannedTotalCost ?? 0;
        const currency = item.currency || 'RUB';
        const hasMissingCost = item.hasMissingCost ?? false;
        return {
          id: item.id,
          itemId: item.itemId,
          status: item.status,
          quantityPlanned: item.quantityPlanned.toNumber(),
          quantityUnit: item.quantityUnit,
          quantityReceived: item.quantityReceived
            ? item.quantityReceived.toNumber()
            : null,
          expectedDate: item.expectedDate,
          receivedDate: item.receivedDate,
          fromBom: item.fromBom,
          note: item.note,
          plannedUnitCost,
          plannedTotalCost,
          currency,
          hasMissingCost,
          sourceType:
            item.sourceType ||
            update_production_order_component_source_dto_1
              .ComponentSourceTypeDto.OWN_STOCK,
          sourceWarehouseId: item.sourceWarehouseId || null,
          targetWarehouseId: item.targetWarehouseId || null,
          plannedSupplyId: item.plannedSupplyId || null,
          plannedTransferId: item.plannedTransferId || null,
          provisionStatus: item.provisionStatus || ProvisionStatus?.NOT_PLANNED,
          provisionedQty:
            item.provisionedQty?.toNumber?.() ?? item.provisionedQty ?? 0,
          item: item.item ?? null,
        };
      }),
    };
  }
  async findOneWithFinance(id) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        ScmProduct: {
          select: {
            id: true,
            internalName: true,
            sku: true,
            type: true,
          },
        },
        ProductionOrderItem: {
          include: {
            item: {
              select: {
                id: true,
                type: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        ScmServiceOperation: {
          select: {
            id: true,
            category: true,
            name: true,
            supplierCounterparty: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            totalAmount: true,
            currency: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        FinancialDocument: {
          select: {
            id: true,
            type: true,
            status: true,
            docNumber: true,
            number: true,
            date: true,
            issueDate: true,
            dueDate: true,
            paidDate: true,
            amountTotal: true,
            amountPaid: true,
            currency: true,
            isAutoCreated: true,
            supplier: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${id} not found`,
      );
    }
    const orderData = await this.findOne(id);
    const serviceOperations = (order.ScmServiceOperation || []).map(
      (service) => ({
        id: service.id,
        category: service.category,
        name: service.name,
        supplier: service.supplierCounterparty || null,
        totalAmount: service.totalAmount ? service.totalAmount.toNumber() : 0,
        currency: service.currency || 'RUB',
      }),
    );
    const financialDocuments = (order.FinancialDocument || []).map((doc) => ({
      id: doc.id,
      type: doc.type || 'OTHER',
      status: doc.status || 'DRAFT',
      number: doc.number || doc.docNumber || '',
      date: doc.date,
      issueDate: doc.issueDate,
      dueDate: doc.dueDate,
      paidDate: doc.paidDate,
      totalAmount: doc.amountTotal?.toNumber() || 0,
      amountPaid: doc.amountPaid?.toNumber() || 0,
      currency: doc.currency || 'RUB',
      supplier: doc.supplier || null,
      isAutoCreated: doc.isAutoCreated,
    }));
    return {
      ...orderData,
      serviceOperations,
      financialDocuments,
    };
  }
  async getServices(orderId) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    const services = await this.prisma.scmServiceOperation.findMany({
      where: { productionOrderId: orderId },
      include: {
        supplierCounterparty: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        supplierService: {
          select: {
            id: true,
            name: true,
            unit: true,
            basePrice: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return services.map((s) => ({
      id: s.id,
      supplierCounterpartyId: s.supplierCounterpartyId,
      supplier: s.supplierCounterparty,
      supplierServiceId: s.supplierServiceId || null,
      serviceName: s.name,
      quantity: s.quantity?.toNumber() ?? 0,
      unit: s.unit || null,
      unitPrice: s.pricePerUnit?.toNumber() ?? 0,
      currency: s.currency || 'RUB',
      total: s.totalAmount?.toNumber() ?? 0,
      notes: s.comment || null,
      createdAt: s.createdAt,
    }));
  }
  async addService(orderId, dto) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    const supplier = await this.prisma.counterparty.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) {
      throw new common_1.NotFoundException(
        `Supplier with ID ${dto.supplierId} not found`,
      );
    }
    let supplierService = null;
    if (dto.supplierServiceId) {
      supplierService = await this.prisma.counterpartyService.findFirst({
        where: {
          id: dto.supplierServiceId,
          supplierId: dto.supplierId,
        },
        select: {
          id: true,
          name: true,
          unit: true,
          basePrice: true,
          currency: true,
        },
      });
      if (!supplierService) {
        throw new common_1.NotFoundException(
          `Supplier service with ID ${dto.supplierServiceId} not found for supplier ${dto.supplierId}`,
        );
      }
    }
    const quantity = Number(dto.quantity);
    const resolvedServiceName = dto.serviceName || (supplierService as any)?.name;
    if (!resolvedServiceName) {
      throw new common_1.BadRequestException('Service name is required');
    }
    const unitPrice =
      dto.unitPrice !== undefined && dto.unitPrice !== null
        ? Number(dto.unitPrice)
        : (supplierService as any)?.basePrice
          ? (supplierService as any).basePrice.toNumber()
          : undefined;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new common_1.BadRequestException(
        'Quantity must be a positive number',
      );
    }
    if (unitPrice === undefined) {
      throw new common_1.BadRequestException('Unit price is required');
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new common_1.BadRequestException(
        'Unit price must be a non-negative number',
      );
    }
    const unit = dto.unit || (supplierService as any)?.unit || null;
    const currency = dto.currency || (supplierService as any)?.currency || 'RUB';
    const totalAmount = quantity * unitPrice;
    try {
      const service = await this.prisma.scmServiceOperation.create({
        data: {
          supplierId: dto.supplierId,
          supplierServiceId: dto.supplierServiceId ?? null,
          productionOrderId: orderId,
          category: client_1.ScmServiceCategory.OTHER,
          name: resolvedServiceName,
          quantity: new client_1.Prisma.Decimal(quantity),
          unit,
          pricePerUnit: new client_1.Prisma.Decimal(unitPrice),
          totalAmount: new client_1.Prisma.Decimal(totalAmount),
          currency,
          comment: dto.notes ?? null,
        },
        include: {
          supplier: {
            select: { id: true, name: true, code: true },
          },
          supplierService: {
            select: {
              id: true,
              name: true,
              unit: true,
              basePrice: true,
              currency: true,
            },
          },
        },
      });
      return {
        id: service.id,
        supplierId: service.supplierId,
        supplier: service.supplier,
        supplierServiceId: service.supplierServiceId,
        serviceName: service.name,
        quantity: service.quantity?.toNumber() ?? 0,
        unit: service.unit || null,
        unitPrice: service.pricePerUnit?.toNumber() ?? 0,
        currency: service.currency,
        total: service.totalAmount?.toNumber() ?? 0,
        notes: service.comment || null,
        createdAt: service.createdAt,
      };
    } catch (e) {
      if (e instanceof library_1.PrismaClientKnownRequestError) {
        throw new common_1.BadRequestException(
          `Invalid service data: ${e.message}`,
        );
      }
      throw e;
    }
  }
  async deleteService(orderId, serviceId) {
    const service = await this.prisma.scmServiceOperation.findFirst({
      where: {
        id: serviceId,
        productionOrderId: orderId,
      },
    });
    if (!service) {
      throw new common_1.NotFoundException(
        `Service with ID ${serviceId} not found for production order ${orderId}`,
      );
    }
    await this.prisma.scmServiceOperation.delete({
      where: { id: serviceId },
    });
    return { success: true };
  }
  async generateSupplyCode() {
    const year = new Date().getFullYear();
    const prefix = `SUP-${year}-`;
    const latest = await this.prisma.scmSupply.findFirst({
      where: {
        code: {
          startsWith: prefix,
        },
      },
      orderBy: { code: 'desc' },
    });
    let sequence = 1;
    if (latest?.code) {
      const match = latest.code.match(/\d+$/);
      if (match) {
        sequence = parseInt(match[0], 10) + 1;
      }
    }
    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }
  async generateProcurementForComponents(orderId) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        ProductionOrderItem: {
          include: {
            item: {
              select: {
                id: true,
                type: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    const itemsAny: any[] = order.ProductionOrderItem || [];
    const actionableItems = itemsAny.filter(
      (c) =>
        c.sourceType !== 'OWN_STOCK' &&
        !c.plannedSupplyId &&
        !c.plannedTransferId,
    );
    const actionableItemIds = Array.from(
      new Set(actionableItems.map((c) => c.itemId).filter((v) => Boolean(v))),
    );
    const offers = actionableItemIds.length
      ? await this.prisma.counterpartyOffer.findMany({
          where: { itemId: { in: actionableItemIds }, isActive: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        })
      : [];
    const offerByItemId = new Map();
    for (const off of offers) {
      if (!offerByItemId.has(off.itemId)) offerByItemId.set(off.itemId, off);
    }
    const skippedComponents: any[] = [];
    const supplyGroups = new Map();
    const transferGroups = new Map();
    for (const c of actionableItems) {
      const sourceType = c.sourceType;
      if (sourceType === 'TRANSFER_FROM_OWN_WAREHOUSE') {
        const fromWh = c.sourceWarehouseId;
        const toWh = c.targetWarehouseId;
        if (!fromWh) {
          skippedComponents.push({
            componentId: c.id,
            reason: 'NO_SOURCE_WAREHOUSE',
          });
          continue;
        }
        if (!toWh) {
          skippedComponents.push({
            componentId: c.id,
            reason: 'NO_TARGET_WAREHOUSE',
          });
          continue;
        }
        const currency = order.currency || 'RUB';
        const key = `${fromWh}::${toWh}::${currency}`;
        if (!transferGroups.has(key)) {
          transferGroups.set(key, {
            fromWarehouseId: fromWh,
            toWarehouseId: toWh,
            currency,
            items: [],
          });
        }
        transferGroups.get(key).items.push(c);
        continue;
      }
      if (
        sourceType === 'PURCHASE_TO_OWN_WAREHOUSE' ||
        sourceType === 'PURCHASE_DIRECT_TO_MANUFACTURE' ||
        sourceType === 'THIRD_PARTY_WAREHOUSE'
      ) {
        const itemId = c.itemId ?? null;
        if (!itemId) {
          skippedComponents.push({ componentId: c.id, reason: 'NO_ITEM_ID' });
          continue;
        }
        const offer = offerByItemId.get(itemId) ?? null;
        const supplierId = offer?.counterpartyId ?? null;
        if (!supplierId) {
          skippedComponents.push({ componentId: c.id, reason: 'NO_OFFER' });
          continue;
        }
        let warehouseId = null;
        if (sourceType === 'PURCHASE_TO_OWN_WAREHOUSE') {
          warehouseId = c.sourceWarehouseId;
        } else if (sourceType === 'PURCHASE_DIRECT_TO_MANUFACTURE') {
          warehouseId = c.targetWarehouseId;
        } else if (sourceType === 'THIRD_PARTY_WAREHOUSE') {
          warehouseId = c.sourceWarehouseId;
        }
        if (!warehouseId) {
          skippedComponents.push({
            componentId: c.id,
            reason: 'NO_TARGET_WAREHOUSE',
          });
          continue;
        }
        const currency =
          offer?.currencyCode || c.currency || order.currency || 'RUB';
        const key = `${supplierId}::${warehouseId}::${currency}`;
        if (!supplyGroups.has(key)) {
          supplyGroups.set(key, {
            supplierId,
            warehouseId,
            currency,
            items: [],
          });
        }
        supplyGroups.get(key).items.push(c);
        continue;
      }
      skippedComponents.push({
        componentId: c.id,
        reason: 'UNSUPPORTED_SOURCE_TYPE',
      });
    }
    const createdSupplies: any[] = [];
    const createdTransfers: any[] = [];
    for (const group of supplyGroups.values()) {
      const code = await this.generateSupplyCode();
      const supply = await this.prisma.scmSupply.create({
        data: {
          code,
          status: 'DRAFT',
          supplierId: group.supplierId,
          warehouseId: group.warehouseId,
          productionOrderId: orderId,
          currency: group.currency,
          items: {
            create: group.items.map((c) => {
              const qty =
                c.quantityPlanned?.toNumber?.() ?? c.quantityPlanned ?? 0;
              const price =
                c.plannedUnitCost?.toNumber?.() ?? c.plannedUnitCost ?? 0;
              const itemId = c.itemId ?? null;
              if (!itemId) {
                throw new common_1.BadRequestException(
                  `ProductionOrderItem ${c.id} has no itemId (MDM-08)`,
                );
              }
              const offer = offerByItemId.get(itemId) ?? null;
              if (!offer) {
                throw new common_1.BadRequestException(
                  `ProductionOrderItem ${c.id} has no active offer for itemId=${itemId} (MDM-09)`,
                );
              }
              return {
                item: { connect: { id: itemId } },
                offerId: offer.id,
                productionOrderItemId: c.id,
                unit: c.quantityUnit,
                quantityOrdered: new client_1.Prisma.Decimal(qty),
                totalReceivedQuantity: new client_1.Prisma.Decimal(0),
                remainingQuantity: new client_1.Prisma.Decimal(qty),
                pricePerUnit: new client_1.Prisma.Decimal(price || offer.price),
                currency: offer.currencyCode,
                description: offer.name || (c.item?.name ?? null),
              };
            }),
          },
        },
      });
      createdSupplies.push({ id: supply.id });
      await this.prisma.productionOrderItem.updateMany({
        where: {
          id: {
            in: group.items.map((c) => c.id),
          },
        },
        data: {
          plannedSupplyId: supply.id,
          provisionStatus:
            (ProvisionStatus as any)?.PLANNED_SUPPLY ??
            (ProvisionStatus as any)?.PLANNED_TRANSFER ??
            (ProvisionStatus as any)?.NOT_PLANNED ??
            null,
        },
      });
    }
    for (const group of transferGroups.values()) {
      const transfer = await this.prisma.scmTransfer.create({
        data: {
          fromWarehouseId: group.fromWarehouseId,
          toWarehouseId: group.toWarehouseId,
          currency: group.currency,
          status: 'DRAFT',
          items: {
            create: group.items.map((c) => {
              const itemId = c.itemId ?? null;
              if (!itemId) {
                throw new common_1.BadRequestException(
                  `ProductionOrderItem ${c.id} has no itemId (MDM-08)`,
                );
              }
              return {
                itemId,
                quantity: c.quantityPlanned,
                receivedQty: 0,
              };
            }),
          },
        },
      });
      createdTransfers.push({ id: transfer.id });
      await this.prisma.productionOrderItem.updateMany({
        where: { id: { in: group.items.map((c) => c.id) } },
        data: { plannedTransferId: transfer.id },
      });
    }
    // StockReservationService has no syncReservationsForProductionOrder() in current implementation.
    setImmediate(() => {
      this.provisioningRecalc.recalcForProductionOrder(orderId);
    });
    return {
      createdSupplies,
      createdTransfers,
      skippedComponents,
    };
  }
  async recalculateProvisionStatusForOrder(orderId) {
    if (this.provisioningRecalc?.recalcForProductionOrder) {
      return this.provisioningRecalc.recalcForProductionOrder(orderId);
    }
    return { ok: true, skipped: true };
  }
  async computeProductionCost(orderId) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        ScmServiceOperation: true,
        ScmProduct: { select: { id: true, brandId: true } },
        ProductionOrderItem: {
          include: {
            item: {
              select: {
                id: true,
                type: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    // Use actual Prisma relation names (no compatibility shims)
    const currency = order.currency || 'RUB';
    const producedItemId = order.producedItemId || order.productId;
    const producedQtyRaw =
      order.producedQty?.toNumber?.() ??
      order.producedQty ??
      order.quantityPlanned?.toNumber?.() ??
      order.quantityPlanned;
    const producedQty = new client_1.Prisma.Decimal(producedQtyRaw || 0);
    if (!producedItemId) {
      throw new common_1.BadRequestException(
        'Produced item is not set for this production order',
      );
    }
    if (producedQty.lte(0)) {
      throw new common_1.BadRequestException(
        'Produced quantity must be greater than zero',
      );
    }
    const MovementDoc = client_1.MovementDocType;
    const MovementType = client_1.MovementType;
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        docType: MovementDoc?.PRODUCTION_INPUT ?? 'PRODUCTION_INPUT',
        docId: orderId,
        movementType: MovementType?.OUTCOME ?? 'OUTCOME',
        quantity: { lt: 0 },
      },
      include: { StockBatche: true },
      orderBy: { createdAt: 'asc' },
    });
    if (movements.some((m) => m.currency && m.currency !== currency)) {
      throw new common_1.BadRequestException(
        'Mixed currencies in production inputs are not supported',
      );
    }
    const materialTotals = {
      base: new client_1.Prisma.Decimal(0),
      logistics: new client_1.Prisma.Decimal(0),
      customs: new client_1.Prisma.Decimal(0),
      inbound: new client_1.Prisma.Decimal(0),
    };
    const materialDetails = new Map();
    for (const mv of movements) {
      const qty = new client_1.Prisma.Decimal(mv.quantity).abs();
      const batch = mv.StockBatche ?? null;
      const baseUnitCost =
        batch?.baseUnitCost !== null && batch?.baseUnitCost !== undefined
          ? new client_1.Prisma.Decimal(batch.baseUnitCost)
          : new client_1.Prisma.Decimal(
              batch?.costPerUnit ?? mv.costPerUnit ?? 0,
            );
      const logisticsUnitCost =
        batch?.logisticsUnitCost !== null &&
        batch?.logisticsUnitCost !== undefined
          ? new client_1.Prisma.Decimal(batch.logisticsUnitCost)
          : new client_1.Prisma.Decimal(0);
      const customsUnitCost =
        batch?.customsUnitCost !== null && batch?.customsUnitCost !== undefined
          ? new client_1.Prisma.Decimal(batch.customsUnitCost)
          : new client_1.Prisma.Decimal(0);
      const inboundUnitCost =
        batch?.inboundUnitCost !== null && batch?.inboundUnitCost !== undefined
          ? new client_1.Prisma.Decimal(batch.inboundUnitCost)
          : new client_1.Prisma.Decimal(0);
      const landedUnitCost = baseUnitCost
        .add(logisticsUnitCost)
        .add(customsUnitCost)
        .add(inboundUnitCost);
      materialTotals.base = materialTotals.base.add(qty.mul(baseUnitCost));
      materialTotals.logistics = materialTotals.logistics.add(
        qty.mul(logisticsUnitCost),
      );
      materialTotals.customs = materialTotals.customs.add(
        qty.mul(customsUnitCost),
      );
      materialTotals.inbound = materialTotals.inbound.add(
        qty.mul(inboundUnitCost),
      );
      const key = mv.itemId;
      const orderItem = (order.ProductionOrderItem ?? []).find(
        (it) => it.itemId === key,
      );
      const detail = materialDetails.get(key) || {
        itemId: key,
        itemName: orderItem?.item?.name || key,
        supplierName: null,
        total: new client_1.Prisma.Decimal(0),
        movements: [],
      };
      const movementTotal = qty.mul(landedUnitCost);
      detail.total = new client_1.Prisma.Decimal(detail.total).add(
        movementTotal,
      );
      detail.movements.push({
        movementId: mv.id,
        batchId: mv.batchId,
        quantity: qty.toNumber(),
        costPerUnit: landedUnitCost.toNumber(),
        baseUnitCost: baseUnitCost.toNumber(),
        logisticsUnitCost: logisticsUnitCost.toNumber(),
        customsUnitCost: customsUnitCost.toNumber(),
        inboundUnitCost: inboundUnitCost.toNumber(),
        total: movementTotal.toNumber(),
      });
      materialDetails.set(key, detail);
    }
    const totalMaterialCost = materialTotals.base
      .add(materialTotals.logistics)
      .add(materialTotals.customs)
      .add(materialTotals.inbound);
    const services = order.ScmServiceOperation || [];
    if (services.some((s) => s.currency && s.currency !== currency)) {
      throw new common_1.BadRequestException(
        'Mixed currencies in services are not supported',
      );
    }
    const serviceItems = services.map((s) => {
      const unitPrice = s.pricePerUnit?.toNumber?.() ?? s.pricePerUnit ?? 0;
      const qty = s.quantity?.toNumber?.() ?? s.quantity ?? 0;
      const total =
        s.totalAmount?.toNumber?.() ??
        s.totalAmount ??
        new client_1.Prisma.Decimal(unitPrice).mul(qty).toNumber();
      return {
        serviceOperationId: s?.id || '',
        serviceName: s.name || s.serviceName || '',
        supplierName: s.supplierCounterparty?.name || null,
        quantity: qty,
        unit: s.unit || null,
        pricePerUnit: unitPrice,
        total,
        currency: s.currency || currency,
      };
    });
    const serviceTotal = serviceItems.reduce(
      (acc, s) => acc.add(new client_1.Prisma.Decimal(s.total ?? 0)),
      new client_1.Prisma.Decimal(0),
    );
    const overhead = await this.overheadRules.calculateForProductionOrder({
      currency,
      producedQty,
      totalMaterialCost,
      productId: producedItemId,
      productBrandId: order.ScmProduct?.brandId ?? null,
      productionCountryId: order.productionCountryId ?? null,
    });
    const totalCost = totalMaterialCost
      .add(serviceTotal)
      .add(overhead.totalOverhead);
    const unitCost = totalCost.div(producedQty);
    const completionDate = new Date();
    const totalCostBase = await this.currencyRates.convertToBase({
      amount: totalCost,
      currency,
      date: completionDate,
    });
    const unitCostBase = totalCostBase.div(producedQty);
    return {
      order,
      producedItemId,
      producedQty,
      currency,
      materialTotals: {
        base: materialTotals.base,
        logistics: materialTotals.logistics,
        customs: materialTotals.customs,
        inbound: materialTotals.inbound,
        total: totalMaterialCost,
      },
      materialItems: Array.from(materialDetails.values()).map((d) => ({
        itemId: d.itemId,
        itemName: d.itemName,
        supplierName: d.supplierName,
        total: new client_1.Prisma.Decimal(d.total).toNumber(),
        movements: d.movements,
      })),
      serviceItems,
      serviceTotal,
      overhead,
      totalCost,
      unitCost,
      totalCostBase,
      unitCostBase,
      completionDate,
    };
  }
  async calculateAndApplyProductionCost(orderId) {
    const cost = await this.computeProductionCost(orderId);
    await this.prisma.productionOrder.update({
      where: { id: orderId },
      data: {
        materialsCostTotal: cost.materialTotals.total,
        servicesCostTotal: cost.serviceTotal,
        otherCostTotal: new client_1.Prisma.Decimal(0),
        totalCost: cost.totalCost,
        unitCost: cost.unitCost,
        totalMaterialCost: cost.materialTotals.total,
        totalServiceCost: cost.serviceTotal,
        overheadCost: cost.overhead.totalOverhead,
        totalCostBase: cost.totalCostBase,
        unitCostBase: cost.unitCostBase,
        currency: cost.currency,
        producedItemId: cost.producedItemId,
        producedQty: cost.producedQty,
      },
    });
    const warehouseId =
      cost.order.outputWarehouseId || cost.order.warehouseId || null;
    if (!warehouseId) {
      throw new common_1.BadRequestException(
        'Output warehouse is not specified for finished goods',
      );
    }
    const batchCode = this.generateBatchCode(cost.order);
    const batch = await this.createProductionBatchForOrder(orderId, {
      productId: cost.producedItemId,
      batchCode,
      totalQty: cost.producedQty,
      expirationDate: null,
    }, undefined);
    let producedMdmItemId;
    if (this.mdmItems?.ensureItemForScmProduct) {
      producedMdmItemId = await this.mdmItems.ensureItemForScmProduct(
        cost.producedItemId,
      );
    } else {
      const sp = await this.prisma.scmProduct.findUnique({
        where: { id: cost.producedItemId },
        select: { itemId: true },
      });
      if (!sp?.itemId) {
        throw new common_1.BadRequestException(
          'ScmProduct.itemId is required for production output',
        );
      }
      producedMdmItemId = sp.itemId;
    }
    const incomeRes = await this.inventoryOrchestrator.recordIncome(
      {
        itemId: producedMdmItemId,
        warehouseId,
        quantity: cost.producedQty,
        unitCost: cost.unitCost,
        currency: cost.currency,
        docType: inventory_enums_1.InventoryDocumentType.PRODUCTION_OUTPUT,
        docId: orderId,
        batchSourceType: inventory_enums_1.InventoryBatchSourceType.PRODUCTION,
        productionBatchId: batch?.id ?? null,
        movementType: inventory_enums_1.InventoryMovementType.INCOME,
        occurredAt: cost.completionDate ?? new Date(),
        meta: {
          productionOrderId: orderId,
          batchCode: batch?.batchCode,
          batchId: batch?.id,
          lineId: batch?.id ?? orderId, // For idempotency key generation
        },
        breakdown: {
          baseUnitCost: cost.unitCost,
          logisticsUnitCost: new client_1.Prisma.Decimal(0),
          customsUnitCost: new client_1.Prisma.Decimal(0),
          inboundUnitCost: new client_1.Prisma.Decimal(0),
        },
        sourceDocType: client_1.AccountingDocType.PRODUCTION_COMPLETION,
        sourceDocId: orderId,
      },
      this.prisma,
    );
    // PostingRun (TZ 8.4.3.2): completion posting must be run-based and idempotent
    const wh = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { countryId: true },
    });
    const sp2 = await this.prisma.scmProduct.findUnique({
      where: { id: cost.producedItemId },
      select: { brandId: true },
    });
    const brandId = sp2?.brandId ?? null;
    const countryId = wh?.countryId ?? null;
    if (!brandId || !countryId) {
      throw new common_1.BadRequestException(
        'Cannot post PRODUCTION_COMPLETION: brandId/countryId not found',
      );
    }
    const bc = await this.prisma.brandCountry.findUnique({
      where: { brandId_countryId: { brandId, countryId } },
      select: { legalEntityId: true },
    });
    if (!bc?.legalEntityId) {
      throw new common_1.BadRequestException(
        'Cannot post PRODUCTION_COMPLETION: BrandCountry.legalEntityId is not configured',
      );
    }
    const run = await this.postingRuns.getOrCreatePostedRun({
      legalEntityId: bc.legalEntityId,
      docType: client_1.AccountingDocType.PRODUCTION_COMPLETION,
      docId: orderId,
    });
    const existingEntries = await this.prisma.accountingEntry.findMany({
      where: { postingRunId: run.id },
      orderBy: [{ lineNumber: 'asc' }],
    });
    const entry =
      existingEntries[0] ??
      (await this.accountingEntries.createEntry({
        docType: client_1.AccountingDocType.PRODUCTION_COMPLETION,
        docId: orderId,
        lineNumber: 1,
        postingDate: cost.completionDate ?? new Date(),
        debitAccount:
          accounting_accounts_config_1.ACCOUNTING_ACCOUNTS
            .INVENTORY_FINISHED_GOODS,
        creditAccount:
          accounting_accounts_config_1.ACCOUNTING_ACCOUNTS.WIP_PRODUCTION,
        amount: cost.totalCost,
        currency: cost.currency,
        description: `Production completed for order ${cost.order?.code ?? orderId}`,
        metadata: {
          docLineId: `production_completion:${orderId}:output`,
          productionOrderId: orderId,
          producedItemId: cost.producedItemId,
        },
        postingRunId: run.id,
      }));
    // InventoryAccountingLink: link output movements ↔ completion entry
    if (incomeRes?.movementId && this.inventoryAccountingLinkWriter) {
      await this.prisma.$transaction(async (tx) => {
        await this.inventoryAccountingLinkWriter.link({
          tx,
          movementIds: [incomeRes.movementId],
          entryIds: [entry.id],
          role: inventory_enums_1.InventoryAccountingLinkRole.PRODUCTION_OUTPUT,
        });
      });
    }
    if (this.stockReservationService) {
      await this.stockReservationService.releaseReservationsForProductionOrder(
        orderId,
      );
    }
    return {
      materialsCostTotal: cost.materialTotals.total.toNumber(),
      servicesCostTotal: cost.serviceTotal.toNumber(),
      otherCostTotal: 0,
      overheadCost: cost.overhead.totalOverhead.toNumber(),
      totalCostBase: cost.totalCostBase.toNumber(),
      unitCostBase: cost.unitCostBase.toNumber(),
      totalCost: cost.totalCost.toNumber(),
      unitCost: cost.unitCost.toNumber(),
      totalMaterialCost: cost.materialTotals.total.toNumber(),
      totalServiceCost: cost.serviceTotal.toNumber(),
      currency: cost.currency,
      producedQty: cost.producedQty.toNumber(),
    };
  }
  async completeProductionOrder(orderId) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        ProductionOrderItem: true,
        warehouses_production_orders_outputWarehouseIdTowarehouses: {
          select: { id: true, name: true, code: true },
        },
      },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    // Use actual Prisma relation names (no compatibility shims)
    if (order.status !== client_1.ProductionOrderStatus.IN_PROGRESS) {
      throw new common_1.UnprocessableEntityException(
        'Production order must be IN_PROGRESS to complete',
      );
    }
    if (!order.outputWarehouseId) {
      throw new common_1.UnprocessableEntityException(
        'Output warehouse is required for production completion.',
      );
    }
    const producedItemId = order.producedItemId || order.productId;
    const producedQty =
      order.producedQty?.toNumber?.() ??
      order.producedQty ??
      order.quantityPlanned?.toNumber?.() ??
      order.quantityPlanned;
    if (
      !producedItemId ||
      !producedQty ||
      new client_1.Prisma.Decimal(producedQty).lte(0)
    ) {
      throw new common_1.UnprocessableEntityException(
        'Produced item and quantity must be specified before completing the order',
      );
    }
    const consumptionSummary = await this.getConsumptionSummary(orderId);
    if (!consumptionSummary.allConsumed) {
      const details = consumptionSummary.items
        .filter((i) => i.remainingToConsume.gt(0))
        .map((i) => ({
          itemId: i.productionOrderItemId,
          plannedQty: i.plannedQty.toString(),
          consumedQty: i.consumedQty.toString(),
        }));
      throw new common_1.BadRequestException({
        message:
          'Cannot complete production: not all components are fully consumed',
        details,
      });
    }
    if (this.provisioningRecalc?.recalcForProductionOrder) {
      await this.provisioningRecalc.recalcForProductionOrder(orderId);
    }
    const refreshed = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        ProductionOrderItem: true,
        warehouses_production_orders_outputWarehouseIdTowarehouses: {
          select: { id: true, name: true, code: true },
        },
      },
    });
    const itemsAny: any[] = refreshed?.ProductionOrderItem ?? [];
    for (const item of itemsAny) {
      const required = new client_1.Prisma.Decimal(
        item.quantityPlanned?.toNumber?.() ?? item.quantityPlanned ?? 0,
      );
      if (item.sourceType === 'OWN_STOCK') {
        const consumed =
          item.consumedQty?.toNumber?.() ?? item.consumedQty ?? 0;
        if (
          !item.isConsumed ||
          new client_1.Prisma.Decimal(consumed).lt(required)
        ) {
          throw new common_1.UnprocessableEntityException(
            `Component ${item.id} was not consumed. Please start production before completing.`,
          );
        }
        const moved = await this.sumProductionInputMovements(
          orderId,
          item.itemId,
        );
        if (moved.lt(required)) {
          throw new common_1.UnprocessableEntityException(
            `Component ${item.id} has insufficient PRODUCTION_INPUT movements: ${moved.toString()} of ${required.toString()}`,
          );
        }
      }
      if (item.sourceType === 'TRANSFER_FROM_OWN_WAREHOUSE') {
        if (!item.plannedTransferId) {
          throw new common_1.UnprocessableEntityException(
            `Component ${item.id} requires transfer but plannedTransferId is missing`,
          );
        }
        const transfer = await this.prisma.scmTransfer.findUnique({
          where: { id: item.plannedTransferId },
          include: { items: true },
        });
        if (!transfer || transfer.status !== 'RECEIVED') {
          throw new common_1.UnprocessableEntityException(
            `Transfer ${item.plannedTransferId} for component ${item.id} is not fully received`,
          );
        }
        const tItem = transfer.items.find((it) => it.itemId === item.itemId);
        const received =
          tItem?.receivedQty?.toNumber?.() ?? tItem?.receivedQty ?? 0;
        if (new client_1.Prisma.Decimal(received).lt(required)) {
          throw new common_1.UnprocessableEntityException(
            `Transfer ${transfer.id} for component ${item.id} is not fully received`,
          );
        }
      }
      if (item.sourceType === 'PURCHASE_DIRECT_TO_MANUFACTURE') {
        if (!item.plannedSupplyId) {
          throw new common_1.UnprocessableEntityException(
            `Component ${item.id} requires supply but plannedSupplyId is missing`,
          );
        }
        const supply = await this.prisma.scmSupply.findUnique({
          where: { id: item.plannedSupplyId },
          include: { items: true },
        });
        if (!supply || supply.status !== 'RECEIVED') {
          throw new common_1.UnprocessableEntityException(
            `Supply ${item.plannedSupplyId} for component ${item.id} is not fully received`,
          );
        }
        const sItem = supply.items.find(
          (it) =>
            it.productionOrderItemId === item.id || it.itemId === item.itemId,
        );
        const received =
          sItem?.totalReceivedQuantity?.toNumber?.() ??
          sItem?.totalReceivedQuantity ??
          0;
        if (new client_1.Prisma.Decimal(received).lt(required)) {
          throw new common_1.UnprocessableEntityException(
            `Supply ${supply.id} for component ${item.id} is not fully received`,
          );
        }
      }
    }
    const cost = await this.calculateAndApplyProductionCost(orderId);
    await this.prisma.productionOrder.update({
      where: { id: orderId },
      data: {
        status: client_1.ProductionOrderStatus.COMPLETED,
      },
    });
    if (this.financialDocuments?.ensureAutoProductionAct) {
      this.financialDocuments
        .ensureAutoProductionAct(orderId)
        .catch((err) =>
          console.error('Failed to auto-create production act', err),
        );
    }
    return { success: true, cost };
  }
  async previewWithFinance(id) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        ScmProduct: {
          select: {
            id: true,
            internalName: true,
            sku: true,
            type: true,
          },
        },
        ScmServiceOperation: {
          select: {
            id: true,
            totalAmount: true,
            currency: true,
          },
        },
        FinancialDocument: {
          select: {
            id: true,
            type: true,
            status: true,
            amountTotal: true,
            amountPaid: true,
            currency: true,
          },
        },
      },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${id} not found`,
      );
    }
    const orderData = await this.findOne(id);
    const serviceOperations = order.ScmServiceOperation || [];
    const financialDocuments = order.FinancialDocument || [];
    const servicesTotalByCurrency = {};
    for (const service of serviceOperations) {
      const currency = service.currency || 'RUB';
      const amount = service.totalAmount?.toNumber() || 0;
      servicesTotalByCurrency[currency] =
        (servicesTotalByCurrency[currency] || 0) + amount;
    }
    const documentsTotalByCurrency = {};
    const documentsPaidByCurrency = {};
    for (const doc of financialDocuments) {
      const currency = doc.currency || 'RUB';
      const total = doc.amountTotal?.toNumber() || 0;
      const paid = doc.amountPaid?.toNumber() || 0;
      documentsTotalByCurrency[currency] =
        (documentsTotalByCurrency[currency] || 0) + total;
      documentsPaidByCurrency[currency] =
        (documentsPaidByCurrency[currency] || 0) + paid;
    }
    return {
      order: orderData.order,
      items: orderData.items || [],
      finance: {
        services: {
          total: (Object.values(servicesTotalByCurrency) as number[]).reduce(
            (sum: number, val: number) => sum + val,
            0,
          ),
          byCurrency: servicesTotalByCurrency,
          count: serviceOperations.length,
          items: serviceOperations.map((s) => ({
            id: s.id,
            totalAmount: s.totalAmount?.toNumber() || 0,
            currency: s.currency || 'RUB',
          })),
        },
        documents: {
          total: (Object.values(documentsTotalByCurrency) as number[]).reduce(
            (sum: number, val: number) => sum + val,
            0,
          ),
          paid: (Object.values(documentsPaidByCurrency) as number[]).reduce(
            (sum: number, val: number) => sum + val,
            0,
          ),
          byCurrency: documentsTotalByCurrency,
          paidByCurrency: documentsPaidByCurrency,
          count: financialDocuments.length,
          items: financialDocuments.map((d) => ({
            id: d.id,
            type: d.type || 'OTHER',
            status: d.status || 'DRAFT',
            totalAmount: d.amountTotal?.toNumber() || 0,
            amountPaid: d.amountPaid?.toNumber() || 0,
            currency: d.currency || 'RUB',
          })),
        },
      },
    };
  }
  async create(dto) {
    const product = await this.prisma.scmProduct.findUnique({
      where: { id: dto.productId },
      include: {
        ScmBomItem: {
          include: {
            MdmItem: {
              select: {
                id: true,
                type: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });
    if (!product) {
      throw new common_1.NotFoundException(
        `SCM product with ID ${dto.productId} not found`,
      );
    }
    const bomItems = product.ScmBomItem ?? [];
    const code = dto.code || (await this.generateOrderCode());
    const name =
      dto.name?.trim() ||
      `${product.internalName} — batch ${dto.quantityPlanned} ${dto.unit}`;
    const order = await this.prisma.productionOrder.create({
      data: {
        code,
        name,
        productId: dto.productId,
        quantityPlanned: dto.quantityPlanned,
        unit: dto.unit,
        producedItemId: dto.producedItemId ?? dto.productId,
        producedQty: dto.producedQty ?? dto.quantityPlanned,
        outputWarehouseId: dto.outputWarehouseId ?? null,
        warehouseId: dto.warehouseId ?? null,
        status: dto.status || client_1.ProductionOrderStatus.PLANNED,
        plannedStartAt: dto.plannedStartAt
          ? new Date(dto.plannedStartAt)
          : null,
        plannedEndAt: dto.plannedEndAt ? new Date(dto.plannedEndAt) : null,
        productionSite: dto.productionSite,
        notes: dto.notes,
        productionCountryId: dto.productionCountryId || null,
        manufacturerId: dto.manufacturerId || null,
      },
    });
    if (bomItems.length > 0) {
      const orderItems: client_1.Prisma.ProductionOrderItemCreateManyInput[] =
        [];
      const bomItemIds = Array.from(
        new Set(bomItems.map((b) => b.itemId).filter(Boolean)),
      );
      const offers = bomItemIds.length
        ? await this.prisma.counterpartyOffer.findMany({
            where: { itemId: { in: bomItemIds }, isActive: true },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          })
        : [];
      const offerByItemId = new Map();
      for (const off of offers) {
        if (!offerByItemId.has(off.itemId)) offerByItemId.set(off.itemId, off);
      }
      for (const bomItem of bomItems) {
        const wastageMultiplier =
          1 +
          (bomItem.wastagePercent
            ? bomItem.wastagePercent.toNumber() / 100
            : 0);
        const quantityPlanned =
          dto.quantityPlanned * bomItem.quantity.toNumber() * wastageMultiplier;
        const mdmItemId = bomItem.itemId;
        if (!mdmItemId) {
          throw new common_1.BadRequestException(
            `BOM item ${bomItem.id} has no itemId (MDM-08)`,
          );
        }
        const offer = offerByItemId.get(mdmItemId) ?? null;
        const plannedUnitCost = offer?.price ? offer.price.toNumber() : 0;
        const plannedTotalCost = plannedUnitCost * quantityPlanned;
        const priceCurrency = offer?.currencyCode || 'RUB';
        const hasMissingCost = !offer;
        orderItems.push({
          productionOrderId: order.id,
          itemId: mdmItemId,
          quantityPlanned,
          quantityUnit: bomItem.unit,
          fromBom: true,
          note: bomItem.note,
          plannedUnitCost,
          plannedTotalCost,
          currency: priceCurrency,
          hasMissingCost,
          sourceType:
            update_production_order_component_source_dto_1
              .ComponentSourceTypeDto.OWN_STOCK,
          sourceWarehouseId: order.warehouseId || null,
          targetWarehouseId: order.warehouseId || null,
          plannedSupplyId: null,
          plannedTransferId: null,
        });
      }
      await this.prisma.productionOrderItem.createMany({
        data: orderItems,
      });
    }
    try {
      const estimatedCost = 0;
      if (estimatedCost > 0 || dto.manufacturerId) {
        await this.prisma.financialDocument.create({
          data: {
            type: client_1.FinancialDocumentType.PRODUCTION,
            amountTotal: estimatedCost,
            currency: 'RUB',
            productionOrderId: order.id,
            supplierId: dto.manufacturerId || null,
            docDate: dto.plannedStartAt
              ? new Date(dto.plannedStartAt)
              : new Date(),
          },
        });
      }
    } catch (error) {
      console.error(
        'Failed to create financial document for production order:',
        error,
      );
    }
    return this.findOne(order.id);
  }
  async update(id, dto) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        ScmServiceOperation: true,
        ProductionBatche: true,
        FinancialDocument: true,
      },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${id} not found`,
      );
    }
    const updateData: client_1.Prisma.ProductionOrderUpdateInput = {};
    if (dto.currency !== undefined && dto.currency !== order.currency) {
      const hasCost =
        order.totalCost && new client_1.Prisma.Decimal(order.totalCost).gt(0);
      const hasServices = (order.ScmServiceOperation?.length ?? 0) > 0;
      const hasBatches = (order.ProductionBatche?.length ?? 0) > 0;
      const hasDocs = (order.FinancialDocument?.length ?? 0) > 0;
      if (hasCost || hasServices || hasBatches || hasDocs) {
        throw new common_1.BadRequestException(
          'Cannot change currency for production order that already has cost, services, batches, or financial documents',
        );
      }
      updateData.currency = dto.currency;
    }
    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }
    if (dto.plannedStartAt !== undefined) {
      updateData.plannedStartAt = dto.plannedStartAt
        ? new Date(dto.plannedStartAt)
        : null;
    }
    if (dto.plannedEndAt !== undefined) {
      updateData.plannedEndAt = dto.plannedEndAt
        ? new Date(dto.plannedEndAt)
        : null;
    }
    if (dto.actualStartAt !== undefined) {
      updateData.actualStartAt = dto.actualStartAt
        ? new Date(dto.actualStartAt)
        : null;
    }
    if (dto.actualEndAt !== undefined) {
      updateData.actualEndAt = dto.actualEndAt
        ? new Date(dto.actualEndAt)
        : null;
    }
    if (dto.productionSite !== undefined) {
      updateData.productionSite = dto.productionSite;
    }
    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }
    if (dto.productionCountryId !== undefined) {
      updateData.Country = dto.productionCountryId
        ? { connect: { id: dto.productionCountryId } }
        : { disconnect: true };
    }
    if (dto.manufacturerId !== undefined) {
      updateData.manufacturer = dto.manufacturerId
        ? { connect: { id: dto.manufacturerId } }
        : { disconnect: true };
    }
    await this.prisma.productionOrder.update({
      where: { id },
      data: updateData,
    });
    return this.findOne(id);
  }
  async createItem(orderId, dto) {
    await this.ensureOrderEditable(orderId);
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    const mdmItem = await this.prisma.mdmItem.findUnique({
      where: { id: dto.itemId },
      select: { id: true, type: true },
    });
    if (!mdmItem) {
      throw new common_1.NotFoundException(
        `MdmItem with ID ${dto.itemId} not found`,
      );
    }
    if (mdmItem.type !== 'MATERIAL' && mdmItem.type !== 'PRODUCT') {
      throw new common_1.BadRequestException(
        'Production components must be MATERIAL or PRODUCT items',
      );
    }
    const item = await this.prisma.productionOrderItem.create({
      data: {
        productionOrderId: orderId,
        itemId: mdmItem.id,
        quantityPlanned: dto.quantityPlanned,
        quantityUnit: dto.quantityUnit,
        fromBom: false,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        note: dto.note,
      },
      include: {
        item: {
          select: { id: true, type: true, code: true, name: true, unit: true },
        },
      },
    });
    const result = {
      id: item.id,
      itemId: item.itemId,
      item: item.item ?? null,
      status: item.status,
      quantityPlanned: item.quantityPlanned.toNumber(),
      quantityUnit: item.quantityUnit,
      quantityReceived: item.quantityReceived
        ? item.quantityReceived.toNumber()
        : null,
      expectedDate: item.expectedDate,
      receivedDate: item.receivedDate,
      fromBom: item.fromBom,
      note: item.note,
    };
    // StockReservationService has no syncReservationsForProductionOrder() in current implementation.
    return result;
  }
  async updateItem(orderId, itemId, dto) {
    await this.ensureOrderEditable(orderId);
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    const existingItem = await this.prisma.productionOrderItem.findFirst({
      where: {
        id: itemId,
        productionOrderId: orderId,
      },
    });
    if (!existingItem) {
      throw new common_1.NotFoundException(
        `Production order item with ID ${itemId} not found for order ${orderId}`,
      );
    }
    const updateData: client_1.Prisma.ProductionOrderItemUpdateInput = {};
    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }
    if (dto.quantityPlanned !== undefined) {
      updateData.quantityPlanned = dto.quantityPlanned;
    }
    if (dto.quantityReceived !== undefined) {
      updateData.quantityReceived = dto.quantityReceived;
    }
    if (dto.quantityUnit !== undefined) {
      updateData.quantityUnit = dto.quantityUnit;
    }
    if (dto.expectedDate !== undefined) {
      updateData.expectedDate = dto.expectedDate
        ? new Date(dto.expectedDate)
        : null;
    }
    if (dto.receivedDate !== undefined) {
      updateData.receivedDate = dto.receivedDate
        ? new Date(dto.receivedDate)
        : null;
    }
    if (dto.note !== undefined) {
      updateData.note = dto.note;
    }
    const item = await this.prisma.productionOrderItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        item: {
          select: { id: true, type: true, code: true, name: true, unit: true },
        },
      },
    });
    const result = {
      id: item.id,
      itemId: item.itemId,
      item: item.item ?? null,
      status: item.status,
      quantityPlanned: item.quantityPlanned.toNumber(),
      quantityUnit: item.quantityUnit,
      quantityReceived: item.quantityReceived
        ? item.quantityReceived.toNumber()
        : null,
      expectedDate: item.expectedDate,
      receivedDate: item.receivedDate,
      fromBom: item.fromBom,
      note: item.note,
    };
    // StockReservationService has no syncReservationsForProductionOrder() in current implementation.
    return result;
  }
  async deleteItem(orderId, itemId) {
    await this.ensureOrderEditable(orderId);
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }
    const existingItem = await this.prisma.productionOrderItem.findFirst({
      where: {
        id: itemId,
        productionOrderId: orderId,
      },
    });
    if (!existingItem) {
      throw new common_1.NotFoundException(
        `Production order item with ID ${itemId} not found for order ${orderId}`,
      );
    }
    await this.prisma.productionOrderItem.delete({
      where: { id: itemId },
    });
    // StockReservationService has no syncReservationsForProductionOrder() in current implementation.
    return { success: true };
  }
  async updateComponentSource(orderId, itemId, dto) {
    if (dto.sourceType !== undefined) {
      await this.ensureCanChangeSourceType({
        orderId,
        componentId: itemId,
        newSourceType: dto.sourceType,
      });
    }
    await this.ensureOrderEditable(orderId);
    const component = await this.prisma.productionOrderItem.findFirst({
      where: {
        id: itemId,
        productionOrderId: orderId,
      },
    });
    if (!component) {
      throw new common_1.NotFoundException(
        `Component ${itemId} not found in production order ${orderId}`,
      );
    }
    let sourceWarehouseId = null;
    let targetWarehouseId = null;
    switch (dto.sourceType) {
      case update_production_order_component_source_dto_1.ComponentSourceTypeDto
        .OWN_STOCK:
      case update_production_order_component_source_dto_1.ComponentSourceTypeDto
        .PURCHASE_TO_OWN_WAREHOUSE:
      case update_production_order_component_source_dto_1.ComponentSourceTypeDto
        .THIRD_PARTY_WAREHOUSE:
        sourceWarehouseId = dto.sourceWarehouseId ?? null;
        targetWarehouseId = null;
        if (
          dto.sourceType ===
            update_production_order_component_source_dto_1
              .ComponentSourceTypeDto.OWN_STOCK &&
          !sourceWarehouseId
        ) {
          throw new common_1.BadRequestException(
            'SOURCE_WAREHOUSE_REQUIRED_FOR_OWN_STOCK',
          );
        }
        break;
      case update_production_order_component_source_dto_1.ComponentSourceTypeDto
        .PURCHASE_DIRECT_TO_MANUFACTURE:
        sourceWarehouseId = null;
        targetWarehouseId = dto.targetWarehouseId ?? null;
        break;
      case update_production_order_component_source_dto_1.ComponentSourceTypeDto
        .TRANSFER_FROM_OWN_WAREHOUSE:
        sourceWarehouseId = dto.sourceWarehouseId ?? null;
        targetWarehouseId = dto.targetWarehouseId ?? null;
        break;
      default:
        sourceWarehouseId = dto.sourceWarehouseId ?? null;
        targetWarehouseId = dto.targetWarehouseId ?? null;
    }
    const updated = await this.prisma.productionOrderItem.update({
      where: { id: itemId },
      data: {
        sourceType: dto.sourceType,
        sourceWarehouseId,
        targetWarehouseId,
        plannedSupplyId:
          dto.sourceType ===
          update_production_order_component_source_dto_1.ComponentSourceTypeDto
            .OWN_STOCK
            ? null
            : component.plannedSupplyId,
        plannedTransferId:
          dto.sourceType ===
          update_production_order_component_source_dto_1.ComponentSourceTypeDto
            .OWN_STOCK
            ? null
            : component.plannedTransferId,
      },
    });
    // StockReservationService has no syncReservationsForProductionOrder() in current implementation.
    setImmediate(() => {
      this.provisioningRecalc.recalcForProductionOrder(orderId);
    });
    return updated;
  }
  async getCostBreakdown(id) {
    const cost = await this.computeProductionCost(id);
    const overheadLines = (cost.overhead?.lines || []).map((l) => ({
      ruleId: l.ruleId,
      name: l.name,
      method: l.method,
      scope: l.scope,
      rate: l.rate?.toString?.() ?? l.rate,
      currency: l.currency ?? cost.currency,
      base: l.base?.toNumber?.() ?? l.base ?? 0,
      amount: l.amount?.toNumber?.() ?? l.amount ?? 0,
    }));
    const response = {
      productionOrderId: id,
      currency: cost.currency,
      orderUnit: cost.order.unit ?? null,
      producedQty: cost.producedQty.toNumber(),
      material: {
        base: cost.materialTotals.base.toNumber(),
        logistics: cost.materialTotals.logistics.toNumber(),
        customs: cost.materialTotals.customs.toNumber(),
        inbound: cost.materialTotals.inbound.toNumber(),
        total: cost.materialTotals.total.toNumber(),
        items: cost.materialItems,
      },
      service: {
        total: cost.serviceTotal.toNumber(),
        items: cost.serviceItems,
      },
      overhead: {
        total: cost.overhead.totalOverhead.toNumber(),
        lines: overheadLines,
      },
      totalCost: cost.totalCost.toNumber(),
      unitCost: cost.unitCost.toNumber(),
      summary: {
        materialCost: cost.materialTotals.total.toNumber(),
        serviceCost: cost.serviceTotal.toNumber(),
        overheadCost: cost.overhead.totalOverhead.toNumber(),
        totalCost: cost.totalCost.toNumber(),
        unitCost: cost.unitCost.toNumber(),
        currency: cost.currency,
        producedQty: cost.producedQty.toNumber(),
      },
    };
    return response;
  }
  async getCostSummary(id) {
    const breakdown = await this.getCostBreakdown(id);
    return {
      productionOrderId: breakdown.productionOrderId,
      materialCost: {
        total: breakdown.material?.total ?? 0,
        currency: breakdown.currency,
        items: (breakdown.material?.items ?? []).map((m) => ({
          componentName: m.itemName,
          quantity:
            m.movements?.reduce((sum, mv) => sum + (mv.quantity ?? 0), 0) ?? 0,
          unit: breakdown?.orderUnit || null,
          unitCost: undefined,
          totalCost: m.total ?? 0,
        })),
      },
      servicesCost: {
        total: breakdown.service?.total ?? 0,
        currency: breakdown.currency,
        items: (breakdown.service?.items ?? []).map((s) => ({
          id: s.serviceOperationId,
          category: '',
          name: s.serviceName,
          supplierName: s.supplierName,
          totalAmount: s.total,
          currency: breakdown.currency,
        })),
      },
      totalCost: breakdown.totalCost,
      currency: breakdown.currency,
    };
  }

  async voidCompletionPosting(orderId, reason) {
    const reasonText = (reason ?? '').trim() || 'void';
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findUnique({
        where: { id: orderId },
        include: {
          ScmProduct: { select: { brandId: true } },
          warehouses_production_orders_outputWarehouseIdTowarehouses: {
            select: { countryId: true },
          },
        },
      });
      if (!order) {
        throw new common_1.NotFoundException(
          `Production order with ID ${orderId} not found`,
        );
      }

      // Downstream guard: forbid void if produced FG batches were already moved out
      const producedBatches = await tx.stockBatch.findMany({
        where: {
          sourceType: inventory_enums_1.InventoryBatchSourceType.PRODUCTION,
          sourceDocId: orderId,
        },
        select: { id: true },
      });
      if (producedBatches.length) {
        const out = await tx.stockMovement.findFirst({
          where: {
            batchId: { in: producedBatches.map((b) => b.id) },
            movementType: { in: ['OUTCOME', 'SCRAP', 'LOSS'] },
          },
          select: { id: true },
        });
        if (out) {
          throw new common_1.ConflictException(
            'Cannot void production completion: produced stock already moved out',
          );
        }
      }

      const brandId = order.ScmProduct?.brandId ?? null;
      const countryId =
        order.warehouses_production_orders_outputWarehouseIdTowarehouses
          ?.countryId ?? null;
      if (!brandId || !countryId) {
        throw new common_1.BadRequestException(
          'Cannot void PRODUCTION_COMPLETION: brandId/countryId not found',
        );
      }
      const bc = await tx.brandCountry.findUnique({
        where: { brandId_countryId: { brandId, countryId } },
        select: { legalEntityId: true },
      });
      if (!bc?.legalEntityId) {
        throw new common_1.BadRequestException(
          'Cannot void PRODUCTION_COMPLETION: BrandCountry.legalEntityId is not configured',
        );
      }
      const legalEntityId = bc.legalEntityId;

      // Idempotency: already voided
      const voidedOriginal = await tx.accountingPostingRun.findFirst({
        where: {
          legalEntityId,
          docType: client_1.AccountingDocType.PRODUCTION_COMPLETION,
          docId: orderId,
          status: 'VOIDED',
          reversalRunId: { not: null },
        },
        orderBy: [{ version: 'desc' }],
        select: { id: true, reversalRunId: true },
      });
      if (voidedOriginal?.reversalRunId) {
        await tx.productionOrder.update({
          where: { id: orderId },
          data: {
            completionVoidedAt: order.completionVoidedAt ?? new Date(),
            completionVoidReason: order.completionVoidReason ?? reasonText,
          },
        });
        return {
          orderId,
          alreadyVoided: true,
          originalRunId: voidedOriginal.id,
          reversalRunId: voidedOriginal.reversalRunId,
        };
      }

      const run = await this.postingRuns.getActivePostedRun({
        tx,
        legalEntityId,
        docType: client_1.AccountingDocType.PRODUCTION_COMPLETION,
        docId: orderId,
      });
      if (!run) {
        throw new common_1.ConflictException(
          'No active PostingRun found for production completion',
        );
      }
      const res = await this.postingRuns.voidRun({
        tx,
        runId: run.id,
        reason: reasonText,
      });

      await tx.productionOrder.update({
        where: { id: orderId },
        data: {
          completionVoidedAt: new Date(),
          completionVoidReason: reasonText,
        },
      });

      return {
        orderId,
        alreadyVoided: false,
        originalRunId: run.id,
        reversalRunId: res?.reversalRun?.id ?? null,
      };
    });
  }

  async repostCompletionPosting(orderId, reason) {
    const reasonText = (reason ?? '').trim() || 'repost';
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findUnique({
        where: { id: orderId },
        include: {
          ScmProduct: { select: { brandId: true } },
          warehouses_production_orders_outputWarehouseIdTowarehouses: {
            select: { countryId: true },
          },
        },
      });
      if (!order) {
        throw new common_1.NotFoundException(
          `Production order with ID ${orderId} not found`,
        );
      }

      const brandId = order.ScmProduct?.brandId ?? null;
      const countryId =
        order.warehouses_production_orders_outputWarehouseIdTowarehouses
          ?.countryId ?? null;
      if (!brandId || !countryId) {
        throw new common_1.BadRequestException(
          'Cannot repost PRODUCTION_COMPLETION: brandId/countryId not found',
        );
      }
      const bc = await tx.brandCountry.findUnique({
        where: { brandId_countryId: { brandId, countryId } },
        select: { legalEntityId: true },
      });
      if (!bc?.legalEntityId) {
        throw new common_1.BadRequestException(
          'Cannot repost PRODUCTION_COMPLETION: BrandCountry.legalEntityId is not configured',
        );
      }
      const legalEntityId = bc.legalEntityId;

      const voidedOriginal = await tx.accountingPostingRun.findFirst({
        where: {
          legalEntityId,
          docType: client_1.AccountingDocType.PRODUCTION_COMPLETION,
          docId: orderId,
          status: 'VOIDED',
          reversalRunId: { not: null },
        },
        orderBy: [{ version: 'desc' }],
        select: { id: true },
      });

      const activeRun = voidedOriginal
        ? null
        : await this.postingRuns.getActivePostedRun({
            tx,
            legalEntityId,
            docType: client_1.AccountingDocType.PRODUCTION_COMPLETION,
            docId: orderId,
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
        docType: client_1.AccountingDocType.PRODUCTION_COMPLETION,
        docId: orderId,
        repostedFromRunId: activeRun?.id ?? voidedOriginal?.id ?? null,
      });

      const docLineId =
        repostRun.version === 1
          ? `production_completion:${orderId}:output`
          : `production_completion:${orderId}:output:v${repostRun.version}`;

      const entry = await this.accountingEntries.createEntry({
        tx,
        docType: client_1.AccountingDocType.PRODUCTION_COMPLETION,
        docId: orderId,
        lineNumber: 1,
        postingDate: new Date(),
        debitAccount:
          accounting_accounts_config_1.ACCOUNTING_ACCOUNTS
            .INVENTORY_FINISHED_GOODS,
        creditAccount:
          accounting_accounts_config_1.ACCOUNTING_ACCOUNTS.WIP_PRODUCTION,
        amount: order.totalCost,
        currency: order.currency,
        description: `Production completion repost for order ${order.code ?? orderId}`,
        metadata: {
          docLineId,
          productionOrderId: orderId,
          producedItemId: order.producedItemId ?? order.productId,
        },
        postingRunId: repostRun.id,
      });

      const outMovements = await tx.stockMovement.findMany({
        where: {
          docType: 'PRODUCTION_OUTPUT',
          docId: orderId,
          movementType: 'INCOME',
        },
        select: { id: true },
      });
      if (outMovements.length) {
        await this.inventoryAccountingLinkWriter.link({
          tx,
          movementIds: outMovements.map((m) => m.id),
          entryIds: [entry.id],
          role: inventory_enums_1.InventoryAccountingLinkRole.PRODUCTION_OUTPUT,
        });
      }

      await tx.productionOrder.update({
        where: { id: orderId },
        data: { completionVoidedAt: null, completionVoidReason: null },
      });

      return {
        orderId,
        postingRunId: repostRun.id,
        version: repostRun.version,
        entryId: entry.id,
      };
    });
  }
  async remove(id) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
    });
    if (!order) {
      throw new common_1.NotFoundException(
        `Production order with ID ${id} not found`,
      );
    }
    if (this.stockReservationService) {
      await this.stockReservationService.releaseReservationsForProductionOrder(
        id,
      );
    }
    await this.prisma.productionOrder.delete({
      where: { id },
    });
    return { message: 'Production order deleted successfully' };
  }
}
