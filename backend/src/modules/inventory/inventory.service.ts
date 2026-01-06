import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
