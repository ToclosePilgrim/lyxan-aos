import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateBomItemDto } from './dto/create-bom-item.dto';
import { UpdateBomItemDto } from './dto/update-bom-item.dto';
import { UpsertBomDto } from './dto/upsert-bom.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ScmBomService {
  constructor(private prisma: PrismaService) {}

  async getBom(productId: string) {
    // Verify product exists
    const product = await this.prisma.scmProduct.findUnique({
      where: { id: productId },
      select: {
        id: true,
        internalName: true,
        type: true,
        sku: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`SCM product with ID ${productId} not found`);
    }

    // Get BOM items with supplier item details
    const items = await this.prisma.scmBomItem.findMany({
      where: { productId },
      include: {
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
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      product: {
        id: product.id,
        name: product.internalName,
        type: product.type,
        sku: product.sku,
      },
      items: items.map((item) => ({
        id: item.id,
        supplierItemId: item.supplierItemId,
        quantity: item.quantity.toNumber(),
        unit: item.unit,
        wastagePercent: item.wastagePercent
          ? item.wastagePercent.toNumber()
          : null,
        isOptional: item.isOptional,
        note: item.note,
        supplierItem: {
          id: item.supplierItem.id,
          name: item.supplierItem.name,
          code: item.supplierItem.code,
          type: item.supplierItem.type,
          category: item.supplierItem.category,
          unit: item.supplierItem.unit,
          supplier: item.supplierItem.supplier,
        },
      })),
    };
  }

  async createBomItem(productId: string, dto: CreateBomItemDto) {
    // Verify product exists
    const product = await this.prisma.scmProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`SCM product with ID ${productId} not found`);
    }

    // Verify supplier item exists
    const supplierItem = await this.prisma.supplierItem.findUnique({
      where: { id: dto.supplierItemId },
    });

    if (!supplierItem) {
      throw new NotFoundException(
        `Supplier item with ID ${dto.supplierItemId} not found`,
      );
    }

    try {
      const bomItem = await this.prisma.scmBomItem.create({
        data: {
          productId,
          supplierItemId: dto.supplierItemId,
          quantity: dto.quantity,
          unit: dto.unit,
          wastagePercent: dto.wastagePercent || null,
          isOptional: dto.isOptional || false,
          note: dto.note || null,
        },
        include: {
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
      });

      return {
        id: bomItem.id,
        supplierItemId: bomItem.supplierItemId,
        quantity: bomItem.quantity.toNumber(),
        unit: bomItem.unit,
        wastagePercent: bomItem.wastagePercent
          ? bomItem.wastagePercent.toNumber()
          : null,
        isOptional: bomItem.isOptional,
        note: bomItem.note,
        supplierItem: {
          id: bomItem.supplierItem.id,
          name: bomItem.supplierItem.name,
          code: bomItem.supplierItem.code,
          type: bomItem.supplierItem.type,
          category: bomItem.supplierItem.category,
          unit: bomItem.supplierItem.unit,
          supplier: bomItem.supplierItem.supplier,
        },
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to create BOM item: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async updateBomItem(
    productId: string,
    id: string,
    dto: UpdateBomItemDto,
  ) {
    // Verify product exists
    const product = await this.prisma.scmProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`SCM product with ID ${productId} not found`);
    }

    // Verify BOM item exists and belongs to product
    const existingItem = await this.prisma.scmBomItem.findFirst({
      where: {
        id,
        productId,
      },
    });

    if (!existingItem) {
      throw new NotFoundException(
        `BOM item with ID ${id} not found for product ${productId}`,
      );
    }

    // Verify supplier item if provided
    if (dto.supplierItemId) {
      const supplierItem = await this.prisma.supplierItem.findUnique({
        where: { id: dto.supplierItemId },
      });

      if (!supplierItem) {
        throw new NotFoundException(
          `Supplier item with ID ${dto.supplierItemId} not found`,
        );
      }
    }

    const updateData: Prisma.ScmBomItemUpdateInput = {};

    if (dto.supplierItemId !== undefined) {
      updateData.supplierItem = {
        connect: { id: dto.supplierItemId },
      };
    }
    if (dto.quantity !== undefined) {
      updateData.quantity = dto.quantity;
    }
    if (dto.unit !== undefined) {
      updateData.unit = dto.unit;
    }
    if (dto.wastagePercent !== undefined) {
      updateData.wastagePercent = dto.wastagePercent || null;
    }
    if (dto.isOptional !== undefined) {
      updateData.isOptional = dto.isOptional;
    }
    if (dto.note !== undefined) {
      updateData.note = dto.note || null;
    }

    const bomItem = await this.prisma.scmBomItem.update({
      where: { id },
      data: updateData,
      include: {
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
    });

    return {
      id: bomItem.id,
      supplierItemId: bomItem.supplierItemId,
      quantity: bomItem.quantity.toNumber(),
      unit: bomItem.unit,
      wastagePercent: bomItem.wastagePercent
        ? bomItem.wastagePercent.toNumber()
        : null,
      isOptional: bomItem.isOptional,
      note: bomItem.note,
      supplierItem: {
        id: bomItem.supplierItem.id,
        name: bomItem.supplierItem.name,
        code: bomItem.supplierItem.code,
        type: bomItem.supplierItem.type,
        category: bomItem.supplierItem.category,
        unit: bomItem.supplierItem.unit,
        supplier: bomItem.supplierItem.supplier,
      },
    };
  }

  async deleteBomItem(productId: string, id: string) {
    // Verify product exists
    const product = await this.prisma.scmProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`SCM product with ID ${productId} not found`);
    }

    // Verify BOM item exists and belongs to product
    const existingItem = await this.prisma.scmBomItem.findFirst({
      where: {
        id,
        productId,
      },
    });

    if (!existingItem) {
      throw new NotFoundException(
        `BOM item with ID ${id} not found for product ${productId}`,
      );
    }

    await this.prisma.scmBomItem.delete({
      where: { id },
    });

    return { success: true };
  }

  async upsertBom(productId: string, dto: UpsertBomDto) {
    // Verify product exists
    const product = await this.prisma.scmProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`SCM product with ID ${productId} not found`);
    }

    // Verify all supplier items exist
    for (const item of dto.items) {
      const supplierItem = await this.prisma.supplierItem.findUnique({
        where: { id: item.supplierItemId },
      });

      if (!supplierItem) {
        throw new NotFoundException(
          `Supplier item with ID ${item.supplierItemId} not found`,
        );
      }
    }

    // Use transaction to replace all items
    return await this.prisma.$transaction(async (tx) => {
      // Delete all existing BOM items
      await tx.scmBomItem.deleteMany({
        where: { productId },
      });

      // Create new items
      const createdItems = await Promise.all(
        dto.items.map((item) =>
          tx.scmBomItem.create({
            data: {
              productId,
              supplierItemId: item.supplierItemId,
              quantity: item.quantity,
              unit: item.unit,
              wastagePercent: item.wastagePercent || null,
              isOptional: item.isOptional || false,
              note: item.note || null,
            },
            include: {
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
          }),
        ),
      );

      return {
        items: createdItems.map((item) => ({
          id: item.id,
          supplierItemId: item.supplierItemId,
          quantity: item.quantity.toNumber(),
          unit: item.unit,
          wastagePercent: item.wastagePercent
            ? item.wastagePercent.toNumber()
            : null,
          isOptional: item.isOptional,
          note: item.note,
          supplierItem: {
            id: item.supplierItem.id,
            name: item.supplierItem.name,
            code: item.supplierItem.code,
            type: item.supplierItem.type,
            category: item.supplierItem.category,
            unit: item.supplierItem.unit,
            supplier: item.supplierItem.supplier,
          },
        })),
      };
    });
  }
}




