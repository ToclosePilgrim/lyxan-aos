import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateSupplierItemDto } from './dto/create-supplier-item.dto';
import { UpdateSupplierItemDto } from './dto/update-supplier-item.dto';
import { FilterSupplierItemsDto } from './dto/filter-supplier-items.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SupplierItemsService {
  constructor(private prisma: PrismaService) {}

  async findAllForSupplier(
    supplierId: string,
    filters?: FilterSupplierItemsDto,
  ) {
    // Verify supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    const where: Prisma.SupplierItemWhereInput = {
      supplierId,
    };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const items = await this.prisma.supplierItem.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

      return items.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      type: item.type,
      category: item.category,
      unit: item.unit,
      isActive: item.isActive,
      description: item.description,
      notes: item.notes,
      sku: item.sku,
      currency: item.currency,
      price: item.price ? item.price.toNumber() : null,
      minOrderQty: item.minOrderQty ? item.minOrderQty.toNumber() : null,
      leadTimeDays: item.leadTimeDays,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  async findOne(supplierId: string, id: string) {
    // Verify supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    const item = await this.prisma.supplierItem.findFirst({
      where: {
        id,
        supplierId,
      },
    });

    if (!item) {
      throw new NotFoundException(
        `Supplier item with ID ${id} not found for supplier ${supplierId}`,
      );
    }

    return {
      id: item.id,
      name: item.name,
      code: item.code,
      type: item.type,
      category: item.category,
      unit: item.unit,
      isActive: item.isActive,
      description: item.description,
      notes: item.notes,
      sku: item.sku,
      currency: item.currency,
      price: item.price ? item.price.toNumber() : null,
      minOrderQty: item.minOrderQty ? item.minOrderQty.toNumber() : null,
      leadTimeDays: item.leadTimeDays,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  async create(supplierId: string, dto: CreateSupplierItemDto) {
    // Verify supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    try {
      const data: Prisma.SupplierItemCreateInput = {
        supplier: {
          connect: { id: supplierId },
        },
        name: dto.name,
        code: dto.code,
        type: dto.type,
        category: dto.category,
        unit: dto.unit,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        description: dto.description,
        notes: dto.notes,
        sku: dto.sku,
        currency: dto.currency,
        price: dto.price ? dto.price : null,
        minOrderQty: dto.minOrderQty ? dto.minOrderQty : null,
        leadTimeDays: dto.leadTimeDays,
      };

      const item = await this.prisma.supplierItem.create({
        data,
      });

      return {
        id: item.id,
        name: item.name,
        code: item.code,
        type: item.type,
        category: item.category,
        unit: item.unit,
        isActive: item.isActive,
        description: item.description,
        sku: item.sku,
        currency: item.currency,
        price: item.price ? item.price.toNumber() : null,
        minOrderQty: item.minOrderQty ? item.minOrderQty.toNumber() : null,
        leadTimeDays: item.leadTimeDays,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Supplier item with code ${dto.code} already exists for this supplier`,
          );
        }
      }
      throw error;
    }
  }

  async update(supplierId: string, id: string, dto: UpdateSupplierItemDto) {
    // Verify supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    // Verify item exists and belongs to supplier
    const existingItem = await this.prisma.supplierItem.findFirst({
      where: {
        id,
        supplierId,
      },
    });

    if (!existingItem) {
      throw new NotFoundException(
        `Supplier item with ID ${id} not found for supplier ${supplierId}`,
      );
    }

    const updateData: Prisma.SupplierItemUpdateInput = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.code !== undefined) {
      updateData.code = dto.code;
    }
    if (dto.type !== undefined) {
      updateData.type = dto.type;
    }
    if (dto.category !== undefined) {
      updateData.category = dto.category;
    }
    if (dto.unit !== undefined) {
      updateData.unit = dto.unit;
    }
    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }
    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }
    if (dto.sku !== undefined) {
      updateData.sku = dto.sku;
    }
    if (dto.currency !== undefined) {
      updateData.currency = dto.currency;
    }
    if (dto.price !== undefined) {
      updateData.price = dto.price ? dto.price : null;
    }
    if (dto.minOrderQty !== undefined) {
      updateData.minOrderQty = dto.minOrderQty ? dto.minOrderQty : null;
    }
    if (dto.leadTimeDays !== undefined) {
      updateData.leadTimeDays = dto.leadTimeDays;
    }

    try {
      const item = await this.prisma.supplierItem.update({
        where: { id },
        data: updateData,
      });

      return {
        id: item.id,
        name: item.name,
        code: item.code,
        type: item.type,
        category: item.category,
        unit: item.unit,
        isActive: item.isActive,
        description: item.description,
        notes: item.notes,
        sku: item.sku,
        currency: item.currency,
        price: item.price ? item.price.toNumber() : null,
        minOrderQty: item.minOrderQty ? item.minOrderQty.toNumber() : null,
        leadTimeDays: item.leadTimeDays,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Supplier item with code ${dto.code} already exists for this supplier`,
          );
        }
      }
      throw error;
    }
  }

  async softDelete(supplierId: string, id: string) {
    // Verify supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    // Verify item exists and belongs to supplier
    const existingItem = await this.prisma.supplierItem.findFirst({
      where: {
        id,
        supplierId,
      },
    });

    if (!existingItem) {
      throw new NotFoundException(
        `Supplier item with ID ${id} not found for supplier ${supplierId}`,
      );
    }

    // Soft delete: set isActive to false
    const item = await this.prisma.supplierItem.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return {
      id: item.id,
      name: item.name,
      code: item.code,
      isActive: item.isActive,
    };
  }
}

