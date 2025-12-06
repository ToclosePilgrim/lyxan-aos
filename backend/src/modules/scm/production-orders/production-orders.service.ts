import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { CreateProductionOrderItemDto } from './dto/create-production-order-item.dto';
import { UpdateProductionOrderItemDto } from './dto/update-production-order-item.dto';
import { FilterProductionOrdersDto } from './dto/filter-production-orders.dto';
import { Prisma, ProductionOrderStatus, FinancialDocumentType } from '@prisma/client';

@Injectable()
export class ProductionOrdersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate production order code (e.g., PR-2025-0001)
   */
  private async generateOrderCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PR-${year}-`;

    // Find the latest order with this prefix
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

  async findAll(filters?: FilterProductionOrdersDto) {
    const where: Prisma.ProductionOrderWhereInput = {};

    if (filters?.status) {
      const statusArray = Array.isArray(filters.status)
        ? filters.status
        : typeof filters.status === 'string'
          ? filters.status.split(',').map((s) => s.trim()) as ProductionOrderStatus[]
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

    // Build OR conditions array
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

    // Handle limit with clamping
    const requestedLimit = filters?.limit ? Number(filters.limit) : undefined;
    const limit = requestedLimit ? Math.min(requestedLimit, 100) : undefined;

    const orders = await this.prisma.productionOrder.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            internalName: true,
            sku: true,
          },
        },
        productionCountry: {
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
      productName: order.product.internalName,
      status: order.status,
      quantityPlanned: order.quantityPlanned.toNumber(),
      unit: order.unit,
      plannedStartAt: order.plannedStartAt,
      plannedEndAt: order.plannedEndAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    // Return array for backward compatibility (frontend expects array)
    // If pagination is needed, can be extended later
    return mappedOrders;
  }

  async findOne(id: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            internalName: true,
            sku: true,
            type: true,
          },
        },
        productionCountry: {
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
        items: {
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
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Production order with ID ${id} not found`);
    }

    return {
      order: {
        id: order.id,
        code: order.code,
        name: order.name,
        status: order.status,
        productId: order.productId,
        productName: order.product.internalName,
        quantityPlanned: order.quantityPlanned.toNumber(),
        unit: order.unit,
        plannedStartAt: order.plannedStartAt,
        plannedEndAt: order.plannedEndAt,
        actualStartAt: order.actualStartAt,
        actualEndAt: order.actualEndAt,
        productionSite: order.productionSite,
        notes: order.notes,
        productionCountryId: order.productionCountryId,
        productionCountry: order.productionCountry,
        manufacturerId: order.manufacturerId,
        manufacturer: order.manufacturer,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      items: order.items.map((item) => ({
        id: item.id,
        supplierItemId: item.supplierItemId,
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

  async findOneWithFinance(id: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            internalName: true,
            sku: true,
            type: true,
          },
        },
        items: {
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
        },
        serviceOperations: {
          select: {
            id: true,
            category: true,
            name: true,
            supplier: {
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
        financialDocuments: {
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
      throw new NotFoundException(`Production order with ID ${id} not found`);
    }

    const orderData = await this.findOne(id);

    return {
      ...orderData,
      serviceOperations: order.serviceOperations.map((service) => ({
        id: service.id,
        category: service.category,
        name: service.name,
        supplier: service.supplier,
        totalAmount: service.totalAmount.toNumber(),
        currency: service.currency,
      })),
      financialDocuments: order.financialDocuments.map((doc) => ({
        id: doc.id,
        type: doc.type,
        status: doc.status,
        number: doc.number,
        date: doc.date,
        issueDate: doc.issueDate,
        dueDate: doc.dueDate,
        paidDate: doc.paidDate,
        totalAmount: doc.amountTotal?.toNumber() || 0,
        amountPaid: doc.amountPaid?.toNumber() || 0,
        currency: doc.currency,
        supplier: doc.supplier,
      })),
    };
  }

  async create(dto: CreateProductionOrderDto) {
    // Verify product exists
    const product = await this.prisma.scmProduct.findUnique({
      where: { id: dto.productId },
      include: {
        bomItems: {
          include: {
            supplierItem: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`SCM product with ID ${dto.productId} not found`);
    }

    // Generate code if not provided
    const code = dto.code || (await this.generateOrderCode());

    // Generate name if not provided
    const name =
      dto.name?.trim() ||
      `${product.internalName} — batch ${dto.quantityPlanned} ${dto.unit}`;

    // Create production order
    const order = await this.prisma.productionOrder.create({
      data: {
        code,
        name,
        productId: dto.productId,
        quantityPlanned: dto.quantityPlanned,
        unit: dto.unit,
        status: dto.status || ProductionOrderStatus.PLANNED,
        plannedStartAt: dto.plannedStartAt ? new Date(dto.plannedStartAt) : null,
        plannedEndAt: dto.plannedEndAt ? new Date(dto.plannedEndAt) : null,
        productionSite: dto.productionSite,
        notes: dto.notes,
        productionCountryId: dto.productionCountryId || null,
        manufacturerId: dto.manufacturerId || null,
      },
    });

    // Create production order items from BOM
    if (product.bomItems.length > 0) {
      const orderItems = product.bomItems.map((bomItem) => {
        const wastageMultiplier =
          1 + (bomItem.wastagePercent ? bomItem.wastagePercent.toNumber() / 100 : 0);
        const quantityPlanned =
          dto.quantityPlanned * bomItem.quantity.toNumber() * wastageMultiplier;

        return {
          productionOrderId: order.id,
          supplierItemId: bomItem.supplierItemId,
          quantityPlanned,
          quantityUnit: bomItem.unit,
          fromBom: true,
          note: bomItem.note,
        };
      });

      await this.prisma.productionOrderItem.createMany({
        data: orderItems,
      });
    }

    // Auto-create financial document for production order
    try {
      // Calculate estimated cost (can be enhanced with actual cost calculation)
      const estimatedCost = 0; // Placeholder - can be calculated from items/services
      
      if (estimatedCost > 0 || dto.manufacturerId) {
        await this.prisma.financialDocument.create({
          data: {
            type: FinancialDocumentType.PRODUCTION,
            amountTotal: estimatedCost,
            currency: 'RUB',
            productionOrderId: order.id,
            supplierId: dto.manufacturerId || null, // manufacturer is a supplier
            docDate: dto.plannedStartAt ? new Date(dto.plannedStartAt) : new Date(),
          },
        });
      }
    } catch (error) {
      // Log error but don't fail production order creation
      console.error('Failed to create financial document for production order:', error);
    }

    return this.findOne(order.id);
  }

  async update(id: string, dto: UpdateProductionOrderDto) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Production order with ID ${id} not found`);
    }

    const updateData: Prisma.ProductionOrderUpdateInput = {};

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
      updateData.productionCountry = dto.productionCountryId
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

  async createItem(
    orderId: string,
    dto: CreateProductionOrderItemDto,
  ) {
    // Verify order exists
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
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

    const item = await this.prisma.productionOrderItem.create({
      data: {
        productionOrderId: orderId,
        supplierItemId: dto.supplierItemId,
        quantityPlanned: dto.quantityPlanned,
        quantityUnit: dto.quantityUnit,
        fromBom: false,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        note: dto.note,
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
      id: item.id,
      supplierItemId: item.supplierItemId,
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
      supplierItem: {
        id: item.supplierItem.id,
        name: item.supplierItem.name,
        code: item.supplierItem.code,
        type: item.supplierItem.type,
        category: item.supplierItem.category,
        unit: item.supplierItem.unit,
        supplier: item.supplierItem.supplier,
      },
    };
  }

  async updateItem(
    orderId: string,
    itemId: string,
    dto: UpdateProductionOrderItemDto,
  ) {
    // Verify order exists
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }

    // Verify item exists and belongs to order
    const existingItem = await this.prisma.productionOrderItem.findFirst({
      where: {
        id: itemId,
        productionOrderId: orderId,
      },
    });

    if (!existingItem) {
      throw new NotFoundException(
        `Production order item with ID ${itemId} not found for order ${orderId}`,
      );
    }

    const updateData: Prisma.ProductionOrderItemUpdateInput = {};

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
      id: item.id,
      supplierItemId: item.supplierItemId,
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
      supplierItem: {
        id: item.supplierItem.id,
        name: item.supplierItem.name,
        code: item.supplierItem.code,
        type: item.supplierItem.type,
        category: item.supplierItem.category,
        unit: item.supplierItem.unit,
        supplier: item.supplierItem.supplier,
      },
    };
  }

  async deleteItem(orderId: string, itemId: string) {
    // Verify order exists
    const order = await this.prisma.productionOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(
        `Production order with ID ${orderId} not found`,
      );
    }

    // Verify item exists and belongs to order
    const existingItem = await this.prisma.productionOrderItem.findFirst({
      where: {
        id: itemId,
        productionOrderId: orderId,
      },
    });

    if (!existingItem) {
      throw new NotFoundException(
        `Production order item with ID ${itemId} not found for order ${orderId}`,
      );
    }

    await this.prisma.productionOrderItem.delete({
      where: { id: itemId },
    });

    return { success: true };
  }

  async getCostBreakdown(id: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            supplierItem: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            supplyItems: {
              include: {
                supply: {
                  select: {
                    id: true,
                    code: true,
                  },
                },
                supplierItem: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
        supplies: {
          include: {
            items: {
              include: {
                supplierItem: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
        serviceOperations: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            financialDocument: {
              select: {
                id: true,
              },
            },
          },
        },
        financialDocuments: {
          select: {
            id: true,
            type: true,
            status: true,
            docNumber: true,
            number: true,
            amountTotal: true,
            currency: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Production order with ID ${id} not found`);
    }

    // Determine base currency (use first available or default to RUB)
    let baseCurrency = 'RUB';
    if (order.supplies.length > 0 && order.supplies[0].items.length > 0) {
      baseCurrency = order.supplies[0].items[0].currency;
    } else if (order.serviceOperations.length > 0) {
      baseCurrency = order.serviceOperations[0].currency;
    } else if (order.financialDocuments.length > 0) {
      baseCurrency = order.financialDocuments[0].currency || 'RUB';
    }

    // Calculate material costs from ScmSupplyItem
    // Materials come from two sources:
    // 1. ScmSupplyItem linked to ProductionOrderItem via productionOrderItemId
    // 2. ScmSupplyItem from ScmSupply linked to ProductionOrder via productionOrderId
    const materialItems: Array<{
      supplyId: string;
      supplyCode: string;
      supplyItemId: string;
      supplierItemName: string;
      quantity: number;
      unit: string;
      pricePerUnit: number;
      total: number;
    }> = [];

    // Collect materials from supply items linked to production order items
    for (const orderItem of order.items) {
      for (const supplyItem of orderItem.supplyItems) {
        const quantity =
          supplyItem.quantityReceived.toNumber() > 0
            ? supplyItem.quantityReceived.toNumber()
            : supplyItem.quantityOrdered.toNumber();
        const pricePerUnit = supplyItem.pricePerUnit.toNumber();
        const total = quantity * pricePerUnit;

        materialItems.push({
          supplyId: supplyItem.supply.id,
          supplyCode: supplyItem.supply.code,
          supplyItemId: supplyItem.id,
          supplierItemName:
            supplyItem.supplierItem?.name || supplyItem.description || 'Unknown',
          quantity,
          unit: supplyItem.unit,
          pricePerUnit,
          total,
        });
      }
    }

    // Also collect materials from supplies directly linked to production order
    for (const supply of order.supplies) {
      for (const supplyItem of supply.items) {
        // Skip if already added via productionOrderItemId
        if (
          materialItems.some((item) => item.supplyItemId === supplyItem.id)
        ) {
          continue;
        }

        const quantity =
          supplyItem.quantityReceived.toNumber() > 0
            ? supplyItem.quantityReceived.toNumber()
            : supplyItem.quantityOrdered.toNumber();
        const pricePerUnit = supplyItem.pricePerUnit.toNumber();
        const total = quantity * pricePerUnit;

        materialItems.push({
          supplyId: supply.id,
          supplyCode: supply.code,
          supplyItemId: supplyItem.id,
          supplierItemName:
            supplyItem.supplierItem?.name || supplyItem.description || 'Unknown',
          quantity,
          unit: supplyItem.unit,
          pricePerUnit,
          total,
        });
      }
    }

    const materialsTotal = materialItems.reduce((sum, item) => sum + item.total, 0);

    // Calculate services costs
    const services: Array<{
      serviceOperationId: string;
      name: string;
      supplierName: string | null;
      quantity: number | null;
      unit: string | null;
      price: number;
      total: number;
    }> = order.serviceOperations.map((service) => ({
      serviceOperationId: service.id,
      name: service.name,
      supplierName: service.supplier?.name || null,
      quantity: service.quantity ? service.quantity.toNumber() : null,
      unit: service.unit || null,
      price: service.pricePerUnit
        ? service.pricePerUnit.toNumber()
        : service.totalAmount.toNumber(),
      total: service.totalAmount.toNumber(),
    }));

    const servicesTotal = services.reduce((sum, service) => sum + service.total, 0);

    // Collect financial document IDs that are already accounted for via services
    const financialDocumentIdsFromServices = new Set(
      order.serviceOperations
        .map((service) => service.financialDocument?.id)
        .filter((id): id is string => id !== null && id !== undefined),
    );

    // Calculate other financial documents (not linked to services)
    // Exclude documents that are already accounted for via services to avoid double counting
    const otherDocuments: Array<{
      financialDocumentId: string;
      type: string;
      status: string;
      number: string;
      amountTotal: number;
    }> = order.financialDocuments
      .filter((doc) => !financialDocumentIdsFromServices.has(doc.id))
      .map((doc) => ({
        financialDocumentId: doc.id,
        type: doc.type || 'OTHER',
        status: doc.status || 'DRAFT',
        number: doc.number || '',
        amountTotal: doc.amountTotal?.toNumber() || 0,
      }));

    const otherTotal = otherDocuments.reduce(
      (sum, doc) => sum + doc.amountTotal,
      0,
    );

    const totalCost = materialsTotal + servicesTotal + otherTotal;

    // Calculate unit cost if quantity is available
    const quantityProduced = order.quantityPlanned.toNumber();
    const unitCost = quantityProduced > 0 ? totalCost / quantityProduced : null;

    return {
      productionOrderId: id,
      quantityProduced: quantityProduced > 0 ? quantityProduced : null,
      currency: baseCurrency,
      materialsTotal,
      servicesTotal,
      otherTotal,
      totalCost,
      unitCost,
      materials: materialItems,
      services,
      otherDocuments,
    };
  }

  async getCostSummary(id: string) {
    // Keep existing method for backward compatibility, but use new implementation
    const breakdown = await this.getCostBreakdown(id);
    
    return {
      productionOrderId: breakdown.productionOrderId,
      materialCost: {
        total: breakdown.materialsTotal,
        currency: breakdown.currency,
        items: breakdown.materials.map((m) => ({
          componentName: m.supplierItemName,
          quantity: m.quantity,
          unit: m.unit,
          unitCost: m.pricePerUnit,
          totalCost: m.total,
        })),
      },
      servicesCost: {
        total: breakdown.servicesTotal,
        currency: breakdown.currency,
        items: breakdown.services.map((s) => ({
          id: s.serviceOperationId,
          category: '', // Not in breakdown, but kept for compatibility
          name: s.name,
          supplierName: s.supplierName,
          totalAmount: s.total,
          currency: breakdown.currency,
        })),
      },
      totalCost: breakdown.totalCost,
      currency: breakdown.currency,
    };
  }

  async remove(id: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`Production order with ID ${id} not found`);
    }

    await this.prisma.productionOrder.delete({
      where: { id },
    });

    return { message: 'Production order deleted successfully' };
  }
}

