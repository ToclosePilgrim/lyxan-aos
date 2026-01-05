import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  assertRequired,
  ScopeValidationException,
} from '../../common/scope/scope.validation';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createAdjustment(params: {
    warehouseId: string;
    itemId: string;
    quantity: Prisma.Decimal | number | string;
    unitCost?: Prisma.Decimal | number | string | null;
    currency?: string | null;
    reason?: string | null;
    meta?: Record<string, unknown>;
  }) {
    const wh = await this.prisma.warehouse.findUnique({
      where: { id: params.warehouseId },
      select: { id: true, countryId: true },
    });
    if (!wh) {
      throw new ScopeValidationException(
        'WAREHOUSE_NOT_FOUND',
        `Warehouse ${params.warehouseId} not found`,
        { warehouseId: params.warehouseId },
      );
    }
    assertRequired(
      wh.countryId,
      'warehouse.countryId',
      'WAREHOUSE_COUNTRY_REQUIRED',
    );

    const qty =
      params.quantity instanceof Prisma.Decimal
        ? params.quantity
        : new Prisma.Decimal(params.quantity);
    const unitCost =
      params.unitCost === undefined || params.unitCost === null
        ? null
        : params.unitCost instanceof Prisma.Decimal
          ? params.unitCost
          : new Prisma.Decimal(params.unitCost);

    return this.prisma.inventoryAdjustment.create({
      data: {
        warehouseId: params.warehouseId,
        itemId: params.itemId,
        quantity: qty,
        unitCost,
        currency: params.currency ?? null,
        reason: params.reason ?? null,
        meta: params.meta ? (params.meta as any) : undefined,
      },
    });
  }

  async adjustBalance(params: {
    warehouseId: string;
    itemId: string;
    quantityDelta: number;
  }) {
    return this.adjustBalanceWithTx(this.prisma as any, params);
  }

  async adjustBalanceWithTx(
    tx: Prisma.TransactionClient | PrismaService,
    params: { warehouseId: string; itemId: string; quantityDelta: number },
  ) {
    const { warehouseId, itemId, quantityDelta } = params;
    const existing = await (tx as any).inventoryBalance.findFirst({
      where: { warehouseId, itemId },
    });
    const balance = existing
      ? await (tx as any).inventoryBalance.update({
          where: { id: existing.id },
          data: { quantity: { increment: quantityDelta } },
        })
      : await (tx as any).inventoryBalance.create({
          data: { warehouseId, itemId, quantity: quantityDelta },
        });

    if (quantityDelta !== 0) {
      const mdmItem = await (tx as any).mdmItem.findUnique({
        where: { id: itemId },
        select: { unit: true },
      });
      const unit = mdmItem?.unit ?? 'pcs';
      const stock = await (tx as any).scmStock.findFirst({
        where: { warehouseId, itemId },
        select: { id: true },
      });
      if (stock) {
        await (tx as any).scmStock.update({
          where: { id: stock.id },
          data: {
            quantity: { increment: new Prisma.Decimal(quantityDelta) },
            unit,
          },
        });
      } else {
        await (tx as any).scmStock.create({
          data: {
            warehouseId,
            itemId,
            quantity: new Prisma.Decimal(quantityDelta),
            unit,
          },
        });
      }
    }

    return balance;
  }

  async getBalanceForWarehouse(warehouseId: string) {
    return this.prisma.inventoryBalance.findMany({
      where: { warehouseId },
      include: {
        MdmItem: {
          select: { id: true, type: true, code: true, name: true, unit: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getTransactionsForSupply(supplyId: string) {
    return this.prisma.inventoryTransaction.findMany({
      where: { supplyId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
