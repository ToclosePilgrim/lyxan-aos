import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateScmSupplyDto } from './dto/create-scm-supply.dto';
import { UpdateScmSupplyDto } from './dto/update-scm-supply.dto';
import { UpdateScmSupplyStatusDto } from './dto/update-scm-supply-status.dto';
import { CreateScmSupplyItemDto } from './dto/create-scm-supply-item.dto';
import { UpdateScmSupplyItemDto } from './dto/update-scm-supply-item.dto';
import { FilterScmSuppliesDto } from './dto/filter-scm-supplies.dto';
import { ConfirmSupplyReceiveDto } from './dto/confirm-receive.dto';
import { ScmSupplyStatus, Prisma, FinancialDocumentType } from '@prisma/client';
import { InventoryService } from '../../inventory/inventory.service';

@Injectable()
export class ScmSuppliesService {
  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  /**
   * Generate supply code (e.g., SUP-2025-0001)
   */
  private async generateSupplyCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SUP-${year}-`;

    const latest = await this.prisma.scmSupply.findFirst({
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

  async findAll(filters?: FilterScmSuppliesDto) {
    const where: Prisma.ScmSupplyWhereInput = {};

    if (filters?.status) {
      const statusArray = filters.status.split(',').map((s) => s.trim()) as ScmSupplyStatus[];
      if (statusArray.length > 0) {
        where.status = { in: statusArray };
      }
    }

    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters?.warehouseId) {
      where.warehouseId = filters.warehouseId;
    }

    if (filters?.productionOrderId) {
      where.productionOrderId = filters.productionOrderId;
    }

    // Handle limit with clamping
    const requestedLimit = filters?.limit ? Number(filters.limit) : undefined;
    const limit = requestedLimit ? Math.min(requestedLimit, 100) : undefined;

    const supplies = await this.prisma.scmSupply.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        productionOrder: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return supplies.map((supply) => ({
      id: supply.id,
      code: supply.code,
      status: supply.status,
      supplierId: supply.supplierId,
      supplier: supply.supplier,
      warehouseId: supply.warehouseId,
      warehouse: supply.warehouse,
      productionOrderId: supply.productionOrderId,
      productionOrder: supply.productionOrder,
      currency: supply.currency,
      totalAmount: supply.totalAmount.toNumber(),
      orderDate: supply.orderDate,
      expectedDate: supply.expectedDate,
      receivedDate: supply.receivedDate,
      comment: supply.comment,
      itemsCount: supply._count.items,
      createdAt: supply.createdAt,
      updatedAt: supply.updatedAt,
    }));
  }

  async findOne(id: string) {
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        productionOrder: {
          select: {
            id: true,
            code: true,
            name: true,
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
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            productionOrderItem: {
              include: {
                productionOrder: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
                supplierItem: {
                  select: {
                    id: true,
                    name: true,
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

    if (!supply) {
      throw new NotFoundException(`Supply with ID ${id} not found`);
    }

    return {
      id: supply.id,
      code: supply.code,
      status: supply.status,
      supplierId: supply.supplierId,
      supplier: supply.supplier,
      warehouseId: supply.warehouseId,
      warehouse: supply.warehouse,
      productionOrderId: supply.productionOrderId,
      productionOrder: supply.productionOrder,
      currency: supply.currency,
      totalAmount: supply.totalAmount.toNumber(),
      orderDate: supply.orderDate,
      expectedDate: supply.expectedDate,
      receivedDate: supply.receivedDate,
      comment: supply.comment,
      items: supply.items.map((item) => ({
        id: item.id,
        supplierItemId: item.supplierItemId,
        supplierItem: item.supplierItem
          ? {
              id: item.supplierItem.id,
              name: item.supplierItem.name,
              code: item.supplierItem.code,
              type: item.supplierItem.type,
              category: item.supplierItem.category,
              unit: item.supplierItem.unit,
              supplier: item.supplierItem.supplier,
            }
          : null,
        productId: item.productId,
        product: item.product
          ? {
              id: item.product.id,
              name: item.product.name,
            }
          : null,
        description: item.description,
        quantityOrdered: item.quantityOrdered.toNumber(),
        quantityReceived: item.quantityReceived.toNumber(),
        unit: item.unit,
        pricePerUnit: item.pricePerUnit.toNumber(),
        currency: item.currency,
        productionOrderItemId: item.productionOrderItemId,
        productionOrderItem: item.productionOrderItem
          ? {
              id: item.productionOrderItem.id,
              productionOrder: item.productionOrderItem.productionOrder,
              supplierItem: item.productionOrderItem.supplierItem,
            }
          : null,
      })),
      createdAt: supply.createdAt,
      updatedAt: supply.updatedAt,
    };
  }

  async findOneWithFinance(id: string) {
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        productionOrder: {
          select: {
            id: true,
            code: true,
            name: true,
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
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            productionOrderItem: {
              include: {
                productionOrder: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
                supplierItem: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
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

    if (!supply) {
      throw new NotFoundException(`Supply with ID ${id} not found`);
    }

    const supplyData = await this.findOne(id);

    return {
      ...supplyData,
      financialDocuments: supply.financialDocuments.map((doc) => ({
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

  async create(dto: CreateScmSupplyDto) {
    // Verify supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${dto.supplierId} not found`);
    }

    // Verify warehouse exists
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${dto.warehouseId} not found`);
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

    // Generate code if not provided
    const code = await this.generateSupplyCode();

    // Create supply
    const supply = await this.prisma.scmSupply.create({
      data: {
        code,
        supplierId: dto.supplierId,
        warehouseId: dto.warehouseId,
        productionOrderId: dto.productionOrderId,
        status: dto.status ?? ScmSupplyStatus.DRAFT,
        currency: dto.currency,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : null,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        comment: dto.comment ?? null,
      },
    });

    // Auto-create financial document for supply
    // Note: Items are created separately, so we'll create document with 0 amount initially
    // The amount can be updated later when items are added
    try {
      await this.prisma.financialDocument.create({
        data: {
          type: FinancialDocumentType.SUPPLY,
          amountTotal: 0, // Will be updated when items are added
          currency: dto.currency || 'RUB',
          scmSupplyId: supply.id,
          supplierId: dto.supplierId,
          docDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
        },
      });
    } catch (error) {
      // Log error but don't fail supply creation
      console.error('Failed to create financial document for supply:', error);
    }

    return this.findOne(supply.id);
  }

  async update(id: string, dto: UpdateScmSupplyDto) {
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id },
    });

    if (!supply) {
      throw new NotFoundException(`Supply with ID ${id} not found`);
    }

    // Don't allow updating if already received
    if (supply.status === ScmSupplyStatus.RECEIVED) {
      throw new BadRequestException(
        'Cannot update supply that is already received',
      );
    }

    const updateData: Prisma.ScmSupplyUpdateInput = {};

    if (dto.warehouseId !== undefined) {
      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: dto.warehouseId },
      });

      if (!warehouse) {
        throw new NotFoundException(`Warehouse with ID ${dto.warehouseId} not found`);
      }

      updateData.warehouse = {
        connect: { id: dto.warehouseId },
      };
    }

    if (dto.productionOrderId !== undefined) {
      if (dto.productionOrderId === null) {
        updateData.productionOrder = { disconnect: true };
      } else {
        const productionOrder = await this.prisma.productionOrder.findUnique({
          where: { id: dto.productionOrderId },
        });

        if (!productionOrder) {
          throw new NotFoundException(
            `Production order with ID ${dto.productionOrderId} not found`,
          );
        }

        updateData.productionOrder = { connect: { id: dto.productionOrderId } };
      }
    }

    if (dto.supplierId !== undefined) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
      });

      if (!supplier) {
        throw new NotFoundException(`Supplier with ID ${dto.supplierId} not found`);
      }

      updateData.supplier = { connect: { id: dto.supplierId } };
    }

    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }

    if (dto.currency !== undefined) {
      updateData.currency = dto.currency;
    }

    if (dto.orderDate !== undefined) {
      updateData.orderDate = dto.orderDate ? new Date(dto.orderDate) : null;
    }

    if (dto.expectedDate !== undefined) {
      updateData.expectedDate = dto.expectedDate
        ? new Date(dto.expectedDate)
        : null;
    }

    if (dto.comment !== undefined) {
      updateData.comment = dto.comment;
    }

    await this.prisma.scmSupply.update({
      where: { id },
      data: updateData,
    });

    return this.findOne(id);
  }

  /**
   * Update supply status and handle stock updates
   */
  async changeStatus(id: string, dto: UpdateScmSupplyStatusDto) {
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!supply) {
      throw new NotFoundException(`Supply with ID ${id} not found`);
    }

    const newStatus = dto.status;

    // Validate status transition
    if (supply.status === ScmSupplyStatus.RECEIVED && newStatus !== ScmSupplyStatus.RECEIVED) {
      throw new BadRequestException(
        'Cannot change status of a fully received supply',
      );
    }

    if (supply.status === ScmSupplyStatus.CANCELED && newStatus !== ScmSupplyStatus.CANCELED) {
      throw new BadRequestException(
        'Cannot change status of a cancelled supply',
      );
    }

    // Handle status changes that require stock updates
    if (
      (newStatus === ScmSupplyStatus.RECEIVED ||
        newStatus === ScmSupplyStatus.PARTIAL_RECEIVED) &&
      supply.status !== ScmSupplyStatus.RECEIVED &&
      supply.status !== ScmSupplyStatus.PARTIAL_RECEIVED
    ) {
      return this.prisma.$transaction(async (tx) => {
        // Reload supply with items and related data
        const supplyWithItems = await tx.scmSupply.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                productionOrderItem: true,
              },
            },
          },
        });

        if (!supplyWithItems) {
          throw new NotFoundException(`Supply with ID ${id} not found`);
        }

        let allReceived = true;
        let anyReceived = false;

        // Process each item
        for (const item of supplyWithItems.items) {
          const quantityReceived = item.quantityReceived.toNumber();
          const quantityOrdered = item.quantityOrdered.toNumber();

          if (quantityReceived > 0) {
            anyReceived = true;

            // Update stock
            // Find existing stock or create new
            // Note: Prisma doesn't support upsert with composite unique constraint directly
            // So we use findFirst and then create/update
            const existingStock = await tx.scmStock.findFirst({
              where: {
                warehouseId: supplyWithItems.warehouseId,
                scmProductId: null,
                supplierItemId: item.supplierItemId,
              },
            });

            if (existingStock) {
              await tx.scmStock.update({
                where: { id: existingStock.id },
                data: {
                  quantity: {
                    increment: quantityReceived,
                  },
                },
              });
            } else {
              await tx.scmStock.create({
                data: {
                  warehouseId: supplyWithItems.warehouseId,
                  supplierItemId: item.supplierItemId,
                  quantity: quantityReceived,
                  unit: item.unit,
                },
              });
            }

            // Update production order item if linked
            if (item.productionOrderItemId) {
              const productionOrderItem = await tx.productionOrderItem.findUnique({
                where: { id: item.productionOrderItemId },
              });

              if (productionOrderItem) {
                const currentReceived =
                  productionOrderItem.quantityReceived?.toNumber() || 0;
                const newReceived = currentReceived + quantityReceived;
                const planned = productionOrderItem.quantityPlanned.toNumber();

                // Update quantity received
                await tx.productionOrderItem.update({
                  where: { id: item.productionOrderItemId },
                  data: {
                    quantityReceived: newReceived,
                    // Update status if fully received
                    status:
                      newReceived >= planned
                        ? 'RECEIVED'
                        : newReceived > 0
                          ? 'PARTIALLY_RECEIVED'
                          : productionOrderItem.status,
                  },
                });
              }
            }
          }

          if (quantityReceived < quantityOrdered) {
            allReceived = false;
          }
        }

        // Determine final status
        const finalStatus = allReceived
          ? ScmSupplyStatus.RECEIVED
          : anyReceived
            ? ScmSupplyStatus.PARTIAL_RECEIVED
            : newStatus;

        // Update supply status and received date
        const updatedSupply = await tx.scmSupply.update({
          where: { id },
          data: {
            status: finalStatus,
            receivedDate: finalStatus === ScmSupplyStatus.RECEIVED
              ? new Date()
              : supplyWithItems.receivedDate,
          },
        });

        return this.findOne(updatedSupply.id);
      });
    }

    // For other status changes, just update the status
    const updatedSupply = await this.prisma.scmSupply.update({
      where: { id },
      data: {
        status: newStatus,
      },
    });

    return this.findOne(updatedSupply.id);
  }

  async findItems(supplyId: string) {
    await this.ensureSupplyExists(supplyId);

    const items = await this.prisma.scmSupplyItem.findMany({
      where: { supplyId },
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
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return items.map((item) => ({
      id: item.id,
      supplierItemId: item.supplierItemId,
      supplierItem: item.supplierItem
        ? {
            id: item.supplierItem.id,
            name: item.supplierItem.name,
            code: item.supplierItem.code,
            type: item.supplierItem.type,
            category: item.supplierItem.category,
            unit: item.supplierItem.unit,
            supplier: item.supplierItem.supplier,
          }
        : null,
      productId: item.productId,
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
          }
        : null,
      description: item.description,
      quantityOrdered: item.quantityOrdered.toNumber(),
      quantityReceived: item.quantityReceived.toNumber(),
      unit: item.unit,
      pricePerUnit: item.pricePerUnit.toNumber(),
      currency: item.currency,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  private async ensureSupplyExists(id: string) {
    const supply = await this.prisma.scmSupply.findUnique({ where: { id } });
    if (!supply) {
      throw new NotFoundException(`Supply with ID ${id} not found`);
    }
  }

  async createItem(supplyId: string, dto: CreateScmSupplyItemDto) {
    await this.ensureSupplyExists(supplyId);

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

    // Verify product if provided
    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
      });

      if (!product) {
        throw new NotFoundException(
          `Product with ID ${dto.productId} not found`,
        );
      }
    }

    const item = await this.prisma.scmSupplyItem.create({
      data: {
        supplyId,
        supplierItemId: dto.supplierItemId ?? null,
        productId: dto.productId ?? null,
        description: dto.description ?? null,
        unit: dto.unit,
        quantityOrdered: dto.quantityOrdered,
        quantityReceived: dto.quantityReceived ?? 0,
        pricePerUnit: dto.pricePerUnit,
        currency: dto.currency,
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
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      id: item.id,
      supplierItemId: item.supplierItemId,
      supplierItem: item.supplierItem
        ? {
            id: item.supplierItem.id,
            name: item.supplierItem.name,
            code: item.supplierItem.code,
            type: item.supplierItem.type,
            category: item.supplierItem.category,
            unit: item.supplierItem.unit,
            supplier: item.supplierItem.supplier,
          }
        : null,
      productId: item.productId,
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
          }
        : null,
      description: item.description,
      quantityOrdered: item.quantityOrdered.toNumber(),
      quantityReceived: item.quantityReceived.toNumber(),
      unit: item.unit,
      pricePerUnit: item.pricePerUnit.toNumber(),
      currency: item.currency,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  async updateItem(
    supplyId: string,
    itemId: string,
    dto: UpdateScmSupplyItemDto,
  ) {
    await this.ensureSupplyExists(supplyId);

    const existingItem = await this.prisma.scmSupplyItem.findFirst({
      where: {
        id: itemId,
        supplyId: supplyId,
      },
    });

    if (!existingItem) {
      throw new NotFoundException(
        `Supply item with ID ${itemId} not found for supply ${supplyId}`,
      );
    }

    const updateData: Prisma.ScmSupplyItemUpdateInput = {};

    if (dto.quantityOrdered !== undefined) {
      updateData.quantityOrdered = dto.quantityOrdered;
    }

    if (dto.quantityReceived !== undefined) {
      updateData.quantityReceived = dto.quantityReceived;
    }

    if (dto.unit !== undefined) {
      updateData.unit = dto.unit;
    }

    if (dto.pricePerUnit !== undefined) {
      updateData.pricePerUnit = dto.pricePerUnit;
    }

    if (dto.currency !== undefined) {
      updateData.currency = dto.currency;
    }

    if (dto.supplierItemId !== undefined) {
      if (dto.supplierItemId === null) {
        updateData.supplierItem = { disconnect: true };
      } else {
        updateData.supplierItem = { connect: { id: dto.supplierItemId } };
      }
    }

    if (dto.productId !== undefined) {
      if (dto.productId === null) {
        updateData.product = { disconnect: true };
      } else {
        updateData.product = { connect: { id: dto.productId } };
      }
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }

    const item = await this.prisma.scmSupplyItem.update({
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
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      id: item.id,
      supplierItemId: item.supplierItemId,
      supplierItem: item.supplierItem
        ? {
            id: item.supplierItem.id,
            name: item.supplierItem.name,
            code: item.supplierItem.code,
            type: item.supplierItem.type,
            category: item.supplierItem.category,
            unit: item.supplierItem.unit,
            supplier: item.supplierItem.supplier,
          }
        : null,
      productId: item.productId,
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
          }
        : null,
      description: item.description,
      quantityOrdered: item.quantityOrdered.toNumber(),
      quantityReceived: item.quantityReceived.toNumber(),
      unit: item.unit,
      pricePerUnit: item.pricePerUnit.toNumber(),
      currency: item.currency,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  async deleteItem(supplyId: string, itemId: string) {
    await this.ensureSupplyExists(supplyId);

    const existingItem = await this.prisma.scmSupplyItem.findFirst({
      where: {
        id: itemId,
        supplyId: supplyId,
      },
    });

    if (!existingItem) {
      throw new NotFoundException(
        `Supply item with ID ${itemId} not found for supply ${supplyId}`,
      );
    }

    await this.prisma.scmSupplyItem.delete({
      where: { id: itemId },
    });

    return { success: true };
  }

  async remove(id: string) {
    await this.ensureSupplyExists(id);

    // Delete items first
    await this.prisma.scmSupplyItem.deleteMany({ where: { supplyId: id } });

    return this.prisma.scmSupply.delete({ where: { id } });
  }

  async confirmReceive(supplyId: string, dto: ConfirmSupplyReceiveDto) {
    const supply = await this.prisma.scmSupply.findUnique({
      where: { id: supplyId },
      include: {
        items: true,
        warehouse: true,
      },
    });

    if (!supply) {
      throw new NotFoundException(`Supply with ID ${supplyId} not found`);
    }

    if (!supply.warehouseId) {
      throw new BadRequestException(
        'Supply must have a warehouseId to confirm receive',
      );
    }

    const itemsMap = new Map(supply.items.map((i) => [i.id, i]));

    // Транзакция: обновление позиций + движение остатков + статус
    const result = await this.prisma.$transaction(async (tx) => {
      let anyReceived = false;
      let allFullyReceived = true;

      for (const itemDto of dto.items) {
        const item = itemsMap.get(itemDto.itemId);
        if (!item) {
          throw new NotFoundException(
            `Supply item with ID ${itemDto.itemId} not found in this supply`,
          );
        }

        const quantityToReceive = itemDto.quantityToReceive ?? 0;
        if (quantityToReceive <= 0) continue;

        const currentReceived = Number(item.quantityReceived ?? 0);
        const newReceived = currentReceived + Number(quantityToReceive);

        if (newReceived > Number(item.quantityOrdered)) {
          throw new BadRequestException(
            `Received quantity for item ${item.id} exceeds ordered quantity`,
          );
        }

        // 1. Обновляем количество полученное по позиции
        await tx.scmSupplyItem.update({
          where: { id: item.id },
          data: {
            quantityReceived: newReceived,
          },
        });

        // 2. Движение остатков (приход на склад по supplierItem или product)
        await this.inventoryService.adjustBalanceWithTx(tx, {
          warehouseId: supply.warehouseId,
          productId: item.productId ?? undefined,
          supplierItemId: item.supplierItemId ?? undefined,
          quantityDelta: quantityToReceive,
          comment:
            dto.comment ??
            `Receive from supply ${supply.code} item ${item.id}`,
          supplyId: supply.id,
          supplyItemId: item.id,
        });

        anyReceived = true;

        if (newReceived < Number(item.quantityOrdered)) {
          allFullyReceived = false;
        }
      }

      // 3. Обновляем статус поставки
      let newStatus = supply.status;

      if (anyReceived) {
        newStatus = allFullyReceived
          ? ScmSupplyStatus.RECEIVED
          : ScmSupplyStatus.PARTIAL_RECEIVED;
      }

      const receivedDate = dto.receivedDate
        ? new Date(dto.receivedDate)
        : supply.receivedDate ?? (allFullyReceived ? new Date() : null);

      const updatedSupply = await tx.scmSupply.update({
        where: { id: supply.id },
        data: {
          status: newStatus,
          receivedDate,
          comment: dto.comment ?? supply.comment,
        },
        include: {
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
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          supplier: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
              type: true,
            },
          },
        },
      });

      return updatedSupply;
    });

    return this.findOne(result.id);
  }
}

