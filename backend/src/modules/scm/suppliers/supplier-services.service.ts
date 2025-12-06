import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateSupplierServiceDto } from './dto/create-supplier-service.dto';
import { UpdateSupplierServiceDto } from './dto/update-supplier-service.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SupplierServicesService {
  constructor(private prisma: PrismaService) {}

  async findAllForSupplier(supplierId: string, isActive?: boolean) {
    // Verify supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    const where: Prisma.SupplierServiceWhereInput = {
      supplierId,
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const services = await this.prisma.supplierService.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    return services.map((service) => ({
      id: service.id,
      name: service.name,
      code: service.code,
      category: service.category,
      unit: service.unit,
      basePrice: service.basePrice ? service.basePrice.toNumber() : null,
      currency: service.currency,
      isActive: service.isActive,
      notes: service.notes,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
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

    const service = await this.prisma.supplierService.findFirst({
      where: {
        id,
        supplierId,
      },
    });

    if (!service) {
      throw new NotFoundException(
        `Supplier service with ID ${id} not found for supplier ${supplierId}`,
      );
    }

    return {
      id: service.id,
      name: service.name,
      code: service.code,
      category: service.category,
      unit: service.unit,
      basePrice: service.basePrice ? service.basePrice.toNumber() : null,
      currency: service.currency,
      isActive: service.isActive,
      notes: service.notes,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }

  async create(supplierId: string, dto: CreateSupplierServiceDto) {
    // Verify supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    try {
      const data: Prisma.SupplierServiceCreateInput = {
        supplier: {
          connect: { id: supplierId },
        },
        name: dto.name,
        code: dto.code || null,
        category: dto.category || 'OTHER',
        unit: dto.unit,
        basePrice: dto.basePrice ? dto.basePrice : null,
        currency: dto.currency,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        notes: dto.notes,
      };

      const service = await this.prisma.supplierService.create({
        data,
      });

      return {
        id: service.id,
        name: service.name,
        code: service.code,
        category: service.category,
        unit: service.unit,
        basePrice: service.basePrice ? service.basePrice.toNumber() : null,
        currency: service.currency,
        isActive: service.isActive,
        notes: service.notes,
        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Supplier service with code ${dto.code} already exists for this supplier`,
          );
        }
      }
      throw error;
    }
  }

  async update(
    supplierId: string,
    id: string,
    dto: UpdateSupplierServiceDto,
  ) {
    // Verify supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
    }

    // Verify service exists and belongs to supplier
    const existingService = await this.prisma.supplierService.findFirst({
      where: {
        id,
        supplierId,
      },
    });

    if (!existingService) {
      throw new NotFoundException(
        `Supplier service with ID ${id} not found for supplier ${supplierId}`,
      );
    }

    const updateData: Prisma.SupplierServiceUpdateInput = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.code !== undefined) {
      updateData.code = dto.code || null;
    }
    if (dto.category !== undefined) {
      updateData.category = dto.category;
    }
    if (dto.unit !== undefined) {
      updateData.unit = dto.unit;
    }
    if (dto.basePrice !== undefined) {
      updateData.basePrice = dto.basePrice ? dto.basePrice : null;
    }
    if (dto.currency !== undefined) {
      updateData.currency = dto.currency;
    }
    if (dto.isActive !== undefined) {
      updateData.isActive = dto.isActive;
    }
    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    try {
      const service = await this.prisma.supplierService.update({
        where: { id },
        data: updateData,
      });

      return {
        id: service.id,
        name: service.name,
        code: service.code,
        category: service.category,
        unit: service.unit,
        basePrice: service.basePrice ? service.basePrice.toNumber() : null,
        currency: service.currency,
        isActive: service.isActive,
        notes: service.notes,
        createdAt: service.createdAt,
        updatedAt: service.updatedAt,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Supplier service with code ${dto.code} already exists for this supplier`,
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

    // Verify service exists and belongs to supplier
    const existingService = await this.prisma.supplierService.findFirst({
      where: {
        id,
        supplierId,
      },
    });

    if (!existingService) {
      throw new NotFoundException(
        `Supplier service with ID ${id} not found for supplier ${supplierId}`,
      );
    }

    // Soft delete: set isActive to false
    const service = await this.prisma.supplierService.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return {
      id: service.id,
      name: service.name,
      code: service.code,
      isActive: service.isActive,
    };
  }
}




