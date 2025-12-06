import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateFinancialDocumentDto } from './dto/create-financial-document.dto';
import { UpdateFinancialDocumentDto } from './dto/update-financial-document.dto';
import { FinancialDocumentFiltersDto } from './dto/financial-document-filters.dto';
import { AttachServiceDto } from './dto/attach-service.dto';
import { Prisma, FinancialDocumentStatus } from '@prisma/client';

@Injectable()
export class FinancialDocumentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: FinancialDocumentFiltersDto) {
    const where: Prisma.FinancialDocumentWhereInput = {};

    if (filters?.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.direction) {
      where.direction = filters.direction;
    }

    if (filters?.productionOrderId) {
      where.productionOrderId = filters.productionOrderId;
    }

    if (filters?.scmSupplyId) {
      where.scmSupplyId = filters.scmSupplyId;
    }

    // Date range filter
    if (filters?.fromDate || filters?.toDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (filters.fromDate) {
        dateFilter.gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        dateFilter.lte = new Date(filters.toDate);
      }
      where.OR = [
        { docDate: dateFilter },
        { date: dateFilter },
        { createdAt: dateFilter },
      ];
    }

    // Search by document number or external ID
    if (filters?.search) {
      where.OR = [
        ...(where.OR || []),
        {
          docNumber: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          number: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          externalId: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const take = Math.min(Number(filters?.limit) || 20, 100);
    const offset = filters?.offset ?? 0;

    const [documents, total] = await Promise.all([
      this.prisma.financialDocument.findMany({
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
            },
          },
          scmSupply: {
            select: {
              id: true,
              code: true,
            },
          },
          _count: {
            select: {
              services: true,
            },
          },
        },
        orderBy: [
          { docDate: 'desc' },
          { date: 'desc' },
          { createdAt: 'desc' },
        ],
        take,
        skip: offset,
      }),
      this.prisma.financialDocument.count({ where }),
    ]);

    return {
      items: documents.map((doc) => ({
        id: doc.id,
        docNumber: doc.docNumber || doc.number,
        docDate: doc.docDate || doc.date,
        type: doc.type,
        direction: doc.direction,
        status: doc.status,
        number: doc.number, // legacy
        date: doc.date, // legacy
        issueDate: doc.issueDate,
        dueDate: doc.dueDate,
        paidDate: doc.paidDate,
        supplierId: doc.supplierId,
        supplier: doc.supplier,
        totalAmount: doc.amountTotal?.toNumber() || 0,
        amountPaid: doc.amountPaid?.toNumber() || 0,
        currency: doc.currency,
        productionOrderId: doc.productionOrderId,
        productionOrder: doc.productionOrder,
        scmSupplyId: doc.scmSupplyId,
        scmSupply: doc.scmSupply,
        supplyId: doc.scmSupplyId, // legacy
        supply: doc.scmSupply, // legacy
        purchaseId: doc.purchaseId,
        expenseId: doc.expenseId,
        externalId: doc.externalId,
        fileUrl: doc.fileUrl,
        notes: doc.notes || doc.comment,
        comment: doc.comment, // legacy
        servicesCount: doc._count.services,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
      total,
    };
  }

  async findOne(id: string) {
    const document = await this.prisma.financialDocument.findUnique({
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
          },
        },
        scmSupply: {
          select: {
            id: true,
            code: true,
          },
        },
        services: {
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
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException(
        `Financial document with ID ${id} not found`,
      );
    }

    return {
      id: document.id,
      docNumber: document.docNumber || document.number,
      docDate: document.docDate || document.date,
      type: document.type,
      direction: document.direction,
      status: document.status,
      number: document.number, // legacy
      date: document.date, // legacy
      issueDate: document.issueDate,
      dueDate: document.dueDate,
      paidDate: document.paidDate,
      supplierId: document.supplierId,
      supplier: document.supplier,
      totalAmount: document.amountTotal?.toNumber() || 0,
      amountPaid: document.amountPaid?.toNumber() || 0,
      currency: document.currency,
      productionOrderId: document.productionOrderId,
      productionOrder: document.productionOrder,
      scmSupplyId: document.scmSupplyId,
      scmSupply: document.scmSupply,
      supplyId: document.scmSupplyId, // legacy
      supply: document.scmSupply, // legacy
      purchaseId: document.purchaseId,
      expenseId: document.expenseId,
      externalId: document.externalId,
      fileUrl: document.fileUrl,
      notes: document.notes || document.comment,
      comment: document.comment, // legacy
      services: (document.services || []).map((service) => ({
        id: service.id,
        category: service.category,
        name: service.name,
        supplier: service.supplier,
        totalAmount: service.totalAmount?.toNumber() || 0,
        currency: service.currency,
        productionOrder: service.productionOrder,
        supply: service.supply,
      })),
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  async create(dto: CreateFinancialDocumentDto) {
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
    if (dto.scmSupplyId) {
      const supply = await this.prisma.scmSupply.findUnique({
        where: { id: dto.scmSupplyId },
      });

      if (!supply) {
        throw new NotFoundException(`Supply with ID ${dto.scmSupplyId} not found`);
      }
    }

    const docDate = dto.docDate ? new Date(dto.docDate) : null;
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    const amountPaid = dto.amountPaid ?? 0;
    const totalAmount = dto.amountTotal ?? 0;

    // Auto-calculate status based on amountPaid if not provided
    let status = dto.status || FinancialDocumentStatus.DRAFT;
    let paidDate: Date | null = null;

    if (dto.status === FinancialDocumentStatus.PAID) {
      paidDate = new Date();
    } else if (!dto.status && totalAmount > 0) {
      if (amountPaid === 0) {
        status = FinancialDocumentStatus.DRAFT;
      } else if (amountPaid >= totalAmount) {
        status = FinancialDocumentStatus.PAID;
        paidDate = new Date();
      } else {
        status = FinancialDocumentStatus.PARTIALLY_PAID;
      }
    }

    return this.prisma.financialDocument.create({
      data: {
        docNumber: dto.docNumber,
        docDate,
        type: dto.type,
        direction: dto.direction,
        status,
        number: dto.docNumber, // legacy
        date: docDate, // legacy
        issueDate: docDate, // legacy
        dueDate,
        paidDate,
        supplierId: dto.supplierId,
        amountTotal: totalAmount,
        amountPaid,
        currency: dto.currency,
        productionOrderId: dto.productionOrderId,
        scmSupplyId: dto.scmSupplyId,
        purchaseId: dto.purchaseId,
        expenseId: dto.expenseId,
        externalId: dto.externalId,
        fileUrl: dto.fileUrl,
        notes: dto.notes,
        comment: dto.notes, // legacy
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
        scmSupply: {
          select: {
            id: true,
            code: true,
          },
        },
        _count: {
          select: {
            services: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateFinancialDocumentDto) {
    const document = await this.prisma.financialDocument.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException(
        `Financial document with ID ${id} not found`,
      );
    }

    const updateData: Prisma.FinancialDocumentUpdateInput = {};

    // Calculate new amountPaid and totalAmount
    const currentAmountPaid = document.amountPaid?.toNumber() || document.amountPaid?.toNumber() || 0;
    const currentTotalAmount = document.amountTotal?.toNumber() || 0;
    const newAmountPaid = dto.amountPaid !== undefined ? dto.amountPaid : currentAmountPaid;
    const newTotalAmount = dto.amountTotal !== undefined ? dto.amountTotal : currentTotalAmount;

    // Auto-update status based on amountPaid if status not explicitly set
    if (dto.status === undefined && dto.amountPaid !== undefined) {
      if (newAmountPaid === 0) {
        updateData.status = FinancialDocumentStatus.DRAFT;
        updateData.paidDate = null;
      } else if (newAmountPaid >= newTotalAmount) {
        updateData.status = FinancialDocumentStatus.PAID;
        if (!document.paidDate) {
          updateData.paidDate = new Date();
        }
      } else {
        updateData.status = FinancialDocumentStatus.PARTIALLY_PAID;
        updateData.paidDate = null;
      }
    } else if (dto.status !== undefined) {
      updateData.status = dto.status;
      if (dto.status === FinancialDocumentStatus.PAID && !document.paidDate) {
        updateData.paidDate = new Date();
      } else if (dto.status !== FinancialDocumentStatus.PAID) {
        updateData.paidDate = null;
      }
    }

    if (dto.docNumber !== undefined) {
      updateData.docNumber = dto.docNumber;
      updateData.number = dto.docNumber; // legacy
    }
    if (dto.docDate !== undefined) {
      const docDate = dto.docDate ? new Date(dto.docDate) : null;
      updateData.docDate = docDate;
      updateData.date = docDate; // legacy
      updateData.issueDate = docDate; // legacy
    }
    if (dto.type !== undefined) {
      updateData.type = dto.type;
    }
    if (dto.direction !== undefined) {
      updateData.direction = dto.direction;
    }
    if (dto.currency !== undefined) {
      updateData.currency = dto.currency;
    }
    if (dto.amountTotal !== undefined) {
      updateData.amountTotal = dto.amountTotal;
      // amountTotal is already set above
    }
    if (dto.amountPaid !== undefined) {
      updateData.amountPaid = dto.amountPaid;
    }
    if (dto.dueDate !== undefined) {
      updateData.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.externalId !== undefined) {
      updateData.externalId = dto.externalId;
    }
    if (dto.fileUrl !== undefined) {
      updateData.fileUrl = dto.fileUrl;
    }
    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
      updateData.comment = dto.notes; // legacy
    }
    if (dto.supplierId !== undefined) {
      if (dto.supplierId === null || dto.supplierId === '') {
        updateData.supplier = { disconnect: true };
      } else {
        const supplier = await this.prisma.supplier.findUnique({
          where: { id: dto.supplierId },
        });
        if (!supplier) {
          throw new NotFoundException(`Supplier with ID ${dto.supplierId} not found`);
        }
        updateData.supplier = { connect: { id: dto.supplierId } };
      }
    }
    if (dto.productionOrderId !== undefined) {
      if (dto.productionOrderId === null || dto.productionOrderId === '') {
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
    if (dto.scmSupplyId !== undefined) {
      if (dto.scmSupplyId === null || dto.scmSupplyId === '') {
        updateData.scmSupply = { disconnect: true };
        // scmSupply is already disconnected above
      } else {
        const supply = await this.prisma.scmSupply.findUnique({
          where: { id: dto.scmSupplyId },
        });

        if (!supply) {
          throw new NotFoundException(`Supply with ID ${dto.scmSupplyId} not found`);
        }

        updateData.scmSupply = { connect: { id: dto.scmSupplyId } };
        // scmSupply is already connected above
      }
    }

    return this.prisma.financialDocument.update({
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
        scmSupply: {
          select: {
            id: true,
            code: true,
          },
        },
        _count: {
          select: {
            services: true,
          },
        },
      },
    });
  }

  async attachService(id: string, dto: AttachServiceDto) {
    const document = await this.prisma.financialDocument.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException(
        `Financial document with ID ${id} not found`,
      );
    }

    // Verify all services exist
    for (const serviceId of dto.serviceIds) {
      const service = await this.prisma.scmServiceOperation.findUnique({
        where: { id: serviceId },
      });

      if (!service) {
        throw new NotFoundException(
          `Service operation with ID ${serviceId} not found`,
        );
      }
    }

    // Update all services to link them to this document
    await this.prisma.scmServiceOperation.updateMany({
      where: {
        id: {
          in: dto.serviceIds,
        },
      },
      data: {
        financialDocumentId: id,
      },
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    const document = await this.prisma.financialDocument.findUnique({
      where: { id },
    });

    if (!document) {
      throw new NotFoundException(
        `Financial document with ID ${id} not found`,
      );
    }

    return this.prisma.financialDocument.delete({
      where: { id },
    });
  }
}

