import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ScmStocksService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: {
    warehouseId?: string;
    supplierItemId?: string;
    scmProductId?: string;
    search?: string;
  }) {
    const where: Prisma.ScmStockWhereInput = {};

    if (filters?.warehouseId) {
      where.warehouseId = filters.warehouseId;
    }

    if (filters?.supplierItemId) {
      where.supplierItemId = filters.supplierItemId;
    }

    if (filters?.scmProductId) {
      where.scmProductId = filters.scmProductId;
    }

    if (filters?.search) {
      where.OR = [
        {
          scmProduct: {
            internalName: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
        },
        {
          supplierItem: {
            name: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    const stocks = await this.prisma.scmStock.findMany({
      where,
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        scmProduct: {
          select: {
            id: true,
            internalName: true,
            sku: true,
          },
        },
        supplierItem: {
          include: {
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
      orderBy: [
        { warehouse: { name: 'asc' } },
        { quantity: 'desc' },
      ],
    });

    return stocks.map((stock) => ({
      id: stock.id,
      warehouseId: stock.warehouseId,
      warehouse: stock.warehouse,
      scmProductId: stock.scmProductId,
      scmProduct: stock.scmProduct,
      supplierItemId: stock.supplierItemId,
      supplierItem: stock.supplierItem
        ? {
            id: stock.supplierItem.id,
            name: stock.supplierItem.name,
            code: stock.supplierItem.code,
            type: stock.supplierItem.type,
            category: stock.supplierItem.category,
            unit: stock.supplierItem.unit,
            supplier: stock.supplierItem.supplier,
          }
        : null,
      quantity: stock.quantity.toNumber(),
      unit: stock.unit,
      createdAt: stock.createdAt,
      updatedAt: stock.updatedAt,
    }));
  }

  async getSummary() {
    const stocks = await this.prisma.scmStock.groupBy({
      by: ['supplierItemId', 'scmProductId'],
      _sum: {
        quantity: true,
      },
      where: {
        OR: [
          { supplierItemId: { not: null } },
          { scmProductId: { not: null } },
        ],
      },
    });

    const itemIds = stocks
      .map((s) => s.supplierItemId)
      .filter((id) => id !== null) as string[];
    const productIds = stocks
      .map((s) => s.scmProductId)
      .filter((id) => id !== null) as string[];

    const supplierItems = await this.prisma.supplierItem.findMany({
      where: { id: { in: itemIds } },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    const scmProducts = await this.prisma.scmProduct.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        internalName: true,
        sku: true,
      },
    });

    return stocks.map((stock) => {
      const supplierItem = stock.supplierItemId
        ? supplierItems.find((si) => si.id === stock.supplierItemId)
        : null;
      const scmProduct = stock.scmProductId
        ? scmProducts.find((sp) => sp.id === stock.scmProductId)
        : null;

      return {
        supplierItemId: stock.supplierItemId,
        scmProductId: stock.scmProductId,
        totalQuantity: stock._sum.quantity?.toNumber() || 0,
        supplierItem: supplierItem
          ? {
              id: supplierItem.id,
              name: supplierItem.name,
              code: supplierItem.code,
              type: supplierItem.type,
              category: supplierItem.category,
              unit: supplierItem.unit,
              supplier: supplierItem.supplier,
            }
          : null,
        scmProduct: scmProduct || null,
      };
    });
  }
}

