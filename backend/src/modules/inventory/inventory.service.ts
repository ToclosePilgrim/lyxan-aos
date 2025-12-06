import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, InventoryDirection } from '@prisma/client';

type PrismaTransactionClient = Parameters<
  Parameters<PrismaService['$transaction']>[0]
>[0];

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async adjustBalance(params: {
    warehouseId: string;
    productId?: string;
    supplierItemId?: string;
    quantityDelta: number; // >0 приход, <0 расход
    comment?: string;
    supplyId?: string;
    supplyItemId?: string;
  }) {
    const {
      warehouseId,
      productId,
      supplierItemId,
      quantityDelta,
      comment,
      supplyId,
      supplyItemId,
    } = params;

    // 1. Завести/обновить запись в InventoryBalance
    const existing = await this.prisma.inventoryBalance.findFirst({
      where: {
        warehouseId,
        productId: productId ?? null,
        supplierItemId: supplierItemId ?? null,
      },
    });

    const balance = existing
      ? await this.prisma.inventoryBalance.update({
          where: { id: existing.id },
          data: {
            quantity: {
              increment: quantityDelta,
            },
          },
        })
      : await this.prisma.inventoryBalance.create({
          data: {
            warehouseId,
            productId: productId ?? null,
            supplierItemId: supplierItemId ?? null,
            quantity: quantityDelta,
          },
        });

    // 2. Записать движение
    await this.prisma.inventoryTransaction.create({
      data: {
        warehouseId,
        productId: productId ?? null,
        supplierItemId: supplierItemId ?? null,
        supplyId: supplyId ?? null,
        supplyItemId: supplyItemId ?? null,
        direction: quantityDelta >= 0 ? InventoryDirection.IN : InventoryDirection.OUT,
        quantity: Math.abs(quantityDelta),
        comment: comment ?? null,
      },
    });

    return balance;
  }

  async adjustBalanceWithTx(
    tx: PrismaTransactionClient,
    params: {
      warehouseId: string;
      productId?: string;
      supplierItemId?: string;
      quantityDelta: number;
      comment?: string;
      supplyId?: string;
      supplyItemId?: string;
    },
  ) {
    const {
      warehouseId,
      productId,
      supplierItemId,
      quantityDelta,
      comment,
      supplyId,
      supplyItemId,
    } = params;

    // 1. Завести/обновить запись в InventoryBalance
    const existing = await tx.inventoryBalance.findFirst({
      where: {
        warehouseId,
        productId: productId ?? null,
        supplierItemId: supplierItemId ?? null,
      },
    });

    const balance = existing
      ? await tx.inventoryBalance.update({
          where: { id: existing.id },
          data: {
            quantity: {
              increment: quantityDelta,
            },
          },
        })
      : await tx.inventoryBalance.create({
          data: {
            warehouseId,
            productId: productId ?? null,
            supplierItemId: supplierItemId ?? null,
            quantity: quantityDelta,
          },
        });

    // 2. Записать движение
    await tx.inventoryTransaction.create({
      data: {
        warehouseId,
        productId: productId ?? null,
        supplierItemId: supplierItemId ?? null,
        supplyId: supplyId ?? null,
        supplyItemId: supplyItemId ?? null,
        direction: quantityDelta >= 0 ? InventoryDirection.IN : InventoryDirection.OUT,
        quantity: Math.abs(quantityDelta),
        comment: comment ?? null,
      },
    });

    return balance;
  }

  async getBalanceForWarehouse(warehouseId: string) {
    return this.prisma.inventoryBalance.findMany({
      where: { warehouseId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        supplierItem: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
            category: true,
            unit: true,
            supplier: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getTransactionsForSupply(supplyId: string) {
    return this.prisma.inventoryTransaction.findMany({
      where: { supplyId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        supplierItem: {
          select: {
            id: true,
            name: true,
            code: true,
            unit: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        supplyItem: {
          select: {
            id: true,
            quantityOrdered: true,
            quantityReceived: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
