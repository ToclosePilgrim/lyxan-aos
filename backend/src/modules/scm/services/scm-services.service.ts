import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateScmServiceDto } from './dto/create-scm-service.dto';
import { UpdateScmServiceDto } from './dto/update-scm-service.dto';
import { FilterScmServicesDto } from './dto/filter-scm-services.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ScmServicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: FilterScmServicesDto) {
    const where: Prisma.ScmServiceOperationWhereInput = {};

    if (filters?.productionOrderId) {
      where.productionOrderId = filters.productionOrderId;
    }

    if (filters?.supplyId) {
      where.supplyId = filters.supplyId;
    }

    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.financialDocumentId) {
      where.financialDocumentId = filters.financialDocumentId;
    }

    const services = await this.prisma.scmServiceOperation.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        productionOrder: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
        supply: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
        financialDocument: {
          select: {
            id: true,
            number: true,
            status: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return services.map((service) => ({
      id: service.id,
      supplierId: service.supplierId,
      supplier: service.supplier,
      category: service.category,
      name: service.name,
      productionOrderId: service.productionOrderId,
      productionOrder: service.productionOrder,
      supplyId: service.supplyId,
      supply: service.supply,
      quantity: service.quantity ? service.quantity.toNumber() : null,
      unit: service.unit,
      pricePerUnit: service.pricePerUnit
        ? service.pricePerUnit.toNumber()
        : null,
      totalAmount: service.totalAmount.toNumber(),
      currency: service.currency,
      financialDocumentId: service.financialDocumentId,
      financialDocument: service.financialDocument,
      comment: service.comment,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    }));
  }

  async findOne(id: string) {
    const service = await this.prisma.scmServiceOperation.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        productionOrder: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
        supply: {
          select: {
            id: true,
            code: true,
            status: true,
          },
        },
        financialDocument: {
          select: {
            id: true,
            number: true,
            status: true,
            type: true,
            date: true,
            dueDate: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException(`Service operation with ID ${id} not found`);
    }

    return {
      id: service.id,
      supplierId: service.supplierId,
      supplier: service.supplier,
      category: service.category,
      name: service.name,
      productionOrderId: service.productionOrderId,
      productionOrder: service.productionOrder,
      supplyId: service.supplyId,
      supply: service.supply,
      quantity: service.quantity ? service.quantity.toNumber() : null,
      unit: service.unit,
      pricePerUnit: service.pricePerUnit
        ? service.pricePerUnit.toNumber()
        : null,
      totalAmount: service.totalAmount.toNumber(),
      currency: service.currency,
      financialDocumentId: service.financialDocumentId,
      financialDocument: service.financialDocument,
      comment: service.comment,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
    };
  }

  async create(dto: CreateScmServiceDto) {
    // Verify supplier if provided
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
      });

      if (!supplier) {
        throw new NotFoundException(`Supplier with ID ${dto.supplierId} not found`);
      }
    }

    // Verify production order if provided
    if (dto.productionOrderId) {
      const productionOrder = await this.prisma.productionOrder.findUnique({
        where: { id: dto.productionOrderId },
      });

      if (!productionOrder) {
        throw new NotFoundException(
          `Production order with ID ${dto.productionOrderId} not found`,
        );
      }
    }

    // Verify supply if provided
    if (dto.supplyId) {
      const supply = await this.prisma.scmSupply.findUnique({
        where: { id: dto.supplyId },
      });

      if (!supply) {
        throw new NotFoundException(`Supply with ID ${dto.supplyId} not found`);
      }
    }

    // Verify financial document if provided
    if (dto.financialDocumentId) {
      const financialDocument =
        await this.prisma.financialDocument.findUnique({
          where: { id: dto.financialDocumentId },
        });

      if (!financialDocument) {
        throw new NotFoundException(
          `Financial document with ID ${dto.financialDocumentId} not found`,
        );
      }
    }

    // At least one of productionOrderId or supplyId must be provided
    if (!dto.productionOrderId && !dto.supplyId) {
      throw new BadRequestException(
        'Either productionOrderId or supplyId must be provided',
      );
    }

    return this.prisma.scmServiceOperation.create({
      data: {
        supplierId: dto.supplierId,
        category: dto.category,
        name: dto.name,
        productionOrderId: dto.productionOrderId,
        supplyId: dto.supplyId,
        quantity: dto.quantity,
        unit: dto.unit,
        pricePerUnit: dto.pricePerUnit,
        totalAmount: dto.totalAmount,
        currency: dto.currency,
        financialDocumentId: dto.financialDocumentId,
        comment: dto.comment,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        productionOrder: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        supply: {
          select: {
            id: true,
            code: true,
          },
        },
        financialDocument: {
          select: {
            id: true,
            number: true,
            status: true,
            type: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateScmServiceDto) {
    const service = await this.prisma.scmServiceOperation.findUnique({
      where: { id },
      include: {
        financialDocument: true,
        productionOrder: true,
      },
    });

    if (!service) {
      throw new NotFoundException(`Service operation with ID ${id} not found`);
    }

    // Check if service is linked to paid document or completed production order
    if (
      service.financialDocument?.status === 'PAID' ||
      service.productionOrder?.status === 'COMPLETED'
    ) {
      throw new BadRequestException(
        'Cannot update service linked to paid document or completed production order',
      );
    }

    // Verify supplier if provided
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
      });

      if (!supplier) {
        throw new NotFoundException(`Supplier with ID ${dto.supplierId} not found`);
      }
    }

    // Verify financial document if provided
    if (dto.financialDocumentId) {
      const financialDocument =
        await this.prisma.financialDocument.findUnique({
          where: { id: dto.financialDocumentId },
        });

      if (!financialDocument) {
        throw new NotFoundException(
          `Financial document with ID ${dto.financialDocumentId} not found`,
        );
      }
    }

    const updateData: Prisma.ScmServiceOperationUpdateInput = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.category !== undefined) {
      updateData.category = dto.category;
    }
    if (dto.supplierId !== undefined) {
      if (dto.supplierId === null || dto.supplierId === "") {
        updateData.supplier = { disconnect: true };
      } else {
        updateData.supplier = { connect: { id: dto.supplierId } };
      }
    }
    if (dto.quantity !== undefined) {
      updateData.quantity = dto.quantity;
    }
    if (dto.unit !== undefined) {
      updateData.unit = dto.unit;
    }
    if (dto.pricePerUnit !== undefined) {
      updateData.pricePerUnit = dto.pricePerUnit;
    }
    if (dto.totalAmount !== undefined) {
      updateData.totalAmount = dto.totalAmount;
    }
    if (dto.currency !== undefined) {
      updateData.currency = dto.currency;
    }
    if (dto.financialDocumentId !== undefined) {
      if (dto.financialDocumentId === null) {
        updateData.financialDocument = { disconnect: true };
      } else {
        updateData.financialDocument = { connect: { id: dto.financialDocumentId } };
      }
    }
    if (dto.comment !== undefined) {
      updateData.comment = dto.comment;
    }

    return this.prisma.scmServiceOperation.update({
      where: { id },
      data: updateData,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        productionOrder: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        supply: {
          select: {
            id: true,
            code: true,
          },
        },
        financialDocument: {
          select: {
            id: true,
            number: true,
            status: true,
            type: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    const service = await this.prisma.scmServiceOperation.findUnique({
      where: { id },
      include: {
        financialDocument: true,
        productionOrder: true,
      },
    });

    if (!service) {
      throw new NotFoundException(`Service operation with ID ${id} not found`);
    }

    // Check if service is linked to paid document or completed production order
    if (
      service.financialDocument?.status === 'PAID' ||
      service.productionOrder?.status === 'COMPLETED'
    ) {
      throw new BadRequestException(
        'Cannot delete service linked to paid document or completed production order',
      );
    }

    return this.prisma.scmServiceOperation.delete({
      where: { id },
    });
  }
}

