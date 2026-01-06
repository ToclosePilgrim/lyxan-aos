import {
  ForbiddenException,
  Injectable,
  Logger,
  MethodNotAllowedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AccountingDocType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { InventoryOrchestratorService } from '../../inventory/inventory-orchestrator.service';
import { ScopeHelperService } from '../../../common/scope/scope-helper.service';
import {
  InventoryBatchSourceType,
  InventoryDocumentType,
  InventoryMovementType,
} from '../../inventory/inventory.enums';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { GetStockLedgerDto } from './dto/get-stock-ledger.dto';
import crypto from 'node:crypto';

/**
 * TZ 9: ScmStock is deprecated as a source-of-truth.
 * This service exposes legacy /scm/stocks endpoints as a read-model over canonical inventory tables:
 * - InventoryBalance (current qty)
 * - StockBatch (FIFO batches)
 * - StockMovement (ledger)
 */
@Injectable()
export class ScmStocksService {
  private readonly logger = new Logger(ScmStocksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryOrchestrator: InventoryOrchestratorService,
    private readonly scopeHelper: ScopeHelperService,
  ) {}

  private async getAllowedWarehouseIdsForScope() {
    const scope = this.scopeHelper.getScope();
    if (scope.isSuperAdmin) return null; // no restriction
    if (!scope.legalEntityId) {
      throw new ForbiddenException('legalEntityId is required for non-admin users');
    }
    return this.scopeHelper.getAllowedWarehouseIds(scope.legalEntityId);
  }

  private async assertWarehouseAllowed(warehouseId: string) {
    const allowed = await this.getAllowedWarehouseIdsForScope();
    if (!allowed) return;
    if (!allowed.includes(warehouseId)) {
      throw new ForbiddenException('Access denied to specified warehouse');
    }
  }

  async listStocks(params?: { warehouseId?: string; search?: string }) {
    const take = 1000;
    const where: any = {};

    this.logger.warn(
      'deprecated_endpoint_backend: ScmStocksService.listStocks is a legacy alias over InventoryBalance',
    );

    const allowedWarehouseIds = await this.getAllowedWarehouseIdsForScope();
    if (params?.warehouseId) {
      await this.assertWarehouseAllowed(params.warehouseId);
      where.warehouseId = params.warehouseId;
    } else if (allowedWarehouseIds) {
      if (allowedWarehouseIds.length === 0) return [];
      where.warehouseId = { in: allowedWarehouseIds };
    }

    const balances = await this.prisma.inventoryBalance.findMany({
      where,
      take,
      orderBy: { updatedAt: 'desc' },
      include: {
        MdmItem: { select: { id: true, code: true, name: true, unit: true } },
      },
    });

    // Aggregate across warehouses by itemId to keep legacy UI shape (no warehouse dimension).
    const byItem = new Map<
      string,
      {
        itemId: string;
        code: string;
        name: string | null;
        quantity: Prisma.Decimal;
        updatedAt: Date;
      }
    >();
    for (const b of balances as any[]) {
      const itemId = b.itemId;
      const prev = byItem.get(itemId);
      const qty = new Prisma.Decimal(b.quantity);
      if (!prev) {
        byItem.set(itemId, {
          itemId,
          code: b.MdmItem?.code ?? itemId,
          name: b.MdmItem?.name ?? null,
          quantity: qty,
          updatedAt: b.updatedAt,
        });
      } else {
        prev.quantity = prev.quantity.add(qty);
        if (b.updatedAt > prev.updatedAt) prev.updatedAt = b.updatedAt;
      }
    }

    const itemIds = [...byItem.keys()];
    const products = itemIds.length
      ? await this.prisma.scmProduct.findMany({
          where: { itemId: { in: itemIds } },
          include: {
            Brand: { select: { name: true } },
          },
        })
      : [];
    const productByItemId = new Map<string, any>();
    for (const p of products as any[]) {
      if (p.itemId) productByItemId.set(p.itemId, p);
    }

    const rows = [...byItem.values()].map((r) => {
      const p = productByItemId.get(r.itemId);
      return {
        id: r.itemId,
        skuId: r.itemId,
        skuCode: r.code,
        skuName: r.name,
        productName: p?.internalName ?? r.name ?? r.code,
        productBrand: p?.Brand?.name ?? '',
        quantity: Number(r.quantity),
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    if (params?.search) {
      const s = params.search.toLowerCase();
      return rows.filter(
        (r) =>
          String(r.skuCode ?? '').toLowerCase().includes(s) ||
          String(r.skuName ?? '').toLowerCase().includes(s) ||
          String(r.productName ?? '').toLowerCase().includes(s) ||
          String(r.productBrand ?? '').toLowerCase().includes(s),
      );
    }

    return rows;
  }

  async getSummary() {
    return this.listStocks();
  }

  async getBatchesByWarehouse(warehouseId: string) {
    this.logger.warn(
      'deprecated_endpoint_backend: ScmStocksService.getBatchesByWarehouse is a legacy alias over StockBatch',
    );
    await this.assertWarehouseAllowed(warehouseId);
    return this.prisma.stockBatch.findMany({
      where: { warehouseId, quantity: { gt: 0 } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        MdmItem: { select: { id: true, code: true, name: true, unit: true } },
        warehouse: { select: { id: true, code: true, name: true, type: true } },
      },
    });
  }

  async getBatchesByItem(itemId: string) {
    this.logger.warn(
      'deprecated_endpoint_backend: ScmStocksService.getBatchesByItem is a legacy alias over StockBatch',
    );
    const allowedWarehouseIds = await this.getAllowedWarehouseIdsForScope();
    return this.prisma.stockBatch.findMany({
      where: {
        itemId,
        quantity: { gt: 0 },
        ...(allowedWarehouseIds ? { warehouseId: { in: allowedWarehouseIds } } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        MdmItem: { select: { id: true, code: true, name: true, unit: true } },
        warehouse: { select: { id: true, code: true, name: true, type: true } },
      },
    });
  }

  async getLedger(dto: GetStockLedgerDto) {
    this.logger.warn(
      'deprecated_endpoint_backend: ScmStocksService.getLedger is a legacy alias over StockMovement',
    );
    const where: any = {};

    const allowedWarehouseIds = await this.getAllowedWarehouseIdsForScope();
    if (dto.warehouseId) {
      await this.assertWarehouseAllowed(dto.warehouseId);
      where.warehouseId = dto.warehouseId;
    } else if (allowedWarehouseIds) {
      // For legacy endpoint, we do not allow cross-tenant scan; restrict to allowed warehouses.
      if (allowedWarehouseIds.length === 0) return { total: 0, rows: [] };
      where.warehouseId = { in: allowedWarehouseIds };
    }
    if (dto.itemId) where.itemId = dto.itemId;
    if (dto.movementType) where.movementType = dto.movementType;
    if (dto.from || dto.to) {
      where.createdAt = {};
      if (dto.from) where.createdAt.gte = new Date(dto.from);
      if (dto.to) where.createdAt.lte = new Date(dto.to);
    }
    const take = Math.min(dto.limit ?? 50, 200);
    const skip = (Math.max(dto.page ?? 1, 1) - 1) * take;
    const orderBy =
      dto.sort === 'createdAt:asc'
        ? { createdAt: 'asc' as const }
        : { createdAt: 'desc' as const };

    const [rows, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          MdmItem: { select: { id: true, code: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          StockBatche: {
            select: { id: true, currency: true, costPerUnit: true, unitCostBase: true },
          },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { total, rows };
  }

  async adjust(dto: AdjustStockDto) {
    const effectiveAt = dto.effectiveAt ? new Date(dto.effectiveAt) : new Date();
    const docId = crypto.randomUUID();
    const meta = {
      reason: dto.reason ?? null,
      requestedAt: new Date().toISOString(),
    };

    return this.prisma.$transaction(async (tx) => {
      if (dto.quantity === 0) {
        throw new UnprocessableEntityException('quantity cannot be 0');
      }
      if (dto.quantity > 0) {
        if (dto.unitCost === undefined || dto.currency === undefined) {
          throw new UnprocessableEntityException(
            'unitCost and currency are required when quantity > 0',
          );
        }
        return this.inventoryOrchestrator.recordIncome(
          {
            warehouseId: dto.warehouseId,
            itemId: dto.itemId,
            quantity: dto.quantity,
            docType: InventoryDocumentType.STOCK_ADJUSTMENT,
            docId,
            movementType: InventoryMovementType.ADJUSTMENT,
            unitCost: dto.unitCost,
            currency: dto.currency,
            occurredAt: effectiveAt,
            batchSourceType: InventoryBatchSourceType.MANUAL_ADJUSTMENT,
            meta: { ...meta, lineId: docId },
            sourceDocType: AccountingDocType.STOCK_ADJUSTMENT,
            sourceDocId: docId,
          },
          tx,
        );
      }
      return this.inventoryOrchestrator.recordOutcome(
        {
          warehouseId: dto.warehouseId,
          itemId: dto.itemId,
          quantity: Math.abs(dto.quantity),
          docType: InventoryDocumentType.STOCK_ADJUSTMENT,
          docId,
          movementType: InventoryMovementType.ADJUSTMENT,
          occurredAt: effectiveAt,
          meta: { ...meta, lineId: docId },
          sourceDocType: AccountingDocType.STOCK_ADJUSTMENT,
          sourceDocId: docId,
        },
        tx,
      );
    });
  }

  // Legacy write endpoint (manual set) is intentionally disabled.
  async updateLegacyStock() {
    throw new MethodNotAllowedException(
      'Legacy ScmStock writes are disabled. Use /scm/stocks/adjust (inventory movements) instead.',
    );
  }
}

