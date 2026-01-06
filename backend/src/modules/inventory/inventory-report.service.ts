import { Injectable, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ScopeHelperService } from '../../common/scope/scope-helper.service';

@Injectable()
export class InventoryReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeHelper: ScopeHelperService,
  ) {}

  async getBalances(params: {
    warehouseId?: string;
    itemId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const scope = this.scopeHelper.getScope();
    const where: any = {};

    if (params.itemId) where.itemId = params.itemId;

    if (!scope.isSuperAdmin) {
      if (!scope.legalEntityId) {
        throw new ForbiddenException('legalEntityId is required for non-admin users');
      }
      const allowedWarehouseIds =
        await this.scopeHelper.getAllowedWarehouseIds(scope.legalEntityId);
      if (allowedWarehouseIds.length === 0) {
        return {
          items: [],
          total: 0,
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 50,
        };
      }
      if (params.warehouseId) {
        if (!allowedWarehouseIds.includes(params.warehouseId)) {
          throw new ForbiddenException('Access denied to specified warehouse');
        }
        where.warehouseId = params.warehouseId;
      } else {
        where.warehouseId = { in: allowedWarehouseIds };
      }
    } else if (params.warehouseId) {
      where.warehouseId = params.warehouseId;
    }

    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 50, 200);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.inventoryBalance.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          MdmItem: { select: { id: true, code: true, name: true, unit: true } },
          warehouse: { select: { id: true, code: true, name: true, type: true } },
        },
      }),
      this.prisma.inventoryBalance.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getBatches(_params: {
    warehouseId: string;
    itemId: string;
    includeZeroQty?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const scope = this.scopeHelper.getScope();
    if (!scope.isSuperAdmin) {
      if (!scope.legalEntityId) {
        throw new ForbiddenException('legalEntityId is required for non-admin users');
      }
      const allowedWarehouseIds =
        await this.scopeHelper.getAllowedWarehouseIds(scope.legalEntityId);
      if (!allowedWarehouseIds.includes(_params.warehouseId)) {
        throw new ForbiddenException('Access denied to specified warehouse');
      }
    }

    const where: any = {
      warehouseId: _params.warehouseId,
      itemId: _params.itemId,
    };
    if (!_params.includeZeroQty) {
      where.quantity = { gt: 0 };
    }
    const page = _params.page ?? 1;
    const pageSize = Math.min(_params.pageSize ?? 50, 200);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.stockBatch.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: {
          MdmItem: { select: { id: true, code: true, name: true, unit: true } },
          warehouse: { select: { id: true, code: true, name: true, type: true } },
        },
      }),
      this.prisma.stockBatch.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getMovements(params: {
    warehouseId?: string;
    itemId?: string;
    dateFrom?: string;
    dateTo?: string;
    movementType?: string;
    docType?: string;
    page?: number;
    pageSize?: number;
  }) {
    // For MVP: require warehouseId and validate it belongs to scope
    const scope = this.scopeHelper.getScope();
    
    if (!scope.isSuperAdmin) {
      if (!params.warehouseId) {
        throw new ForbiddenException(
          'warehouseId is required for non-admin users',
        );
      }
      
      // Validate warehouse belongs to scope
      if (scope.legalEntityId) {
        const allowedWarehouseIds =
          await this.scopeHelper.getAllowedWarehouseIds(scope.legalEntityId);
        if (!allowedWarehouseIds.includes(params.warehouseId)) {
          throw new ForbiddenException(
            'Access denied to specified warehouse',
          );
        }
      }
    }

    // Build where clause with warehouse filter
    const where: any = {};
    if (params.warehouseId) {
      where.warehouseId = params.warehouseId;
    }
    if (params.itemId) {
      where.itemId = params.itemId;
    }
    if (params.movementType) {
      where.movementType = params.movementType;
    }
    if (params.docType) {
      where.docType = params.docType;
    }
    if (params.dateFrom || params.dateTo) {
      where.createdAt = {};
      if (params.dateFrom) {
        where.createdAt.gte = new Date(params.dateFrom);
      }
      if (params.dateTo) {
        where.createdAt.lte = new Date(params.dateTo);
      }
    }

    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 50, 100);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          MdmItem: {
            select: { id: true, name: true, code: true },
          },
          warehouse: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
