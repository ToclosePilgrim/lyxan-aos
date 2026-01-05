import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class InventoryReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalances(_params: {
    warehouseId?: string;
    itemId?: string;
    page?: number;
    pageSize?: number;
  }) {
    return {
      items: [],
      total: 0,
      page: _params.page ?? 1,
      pageSize: _params.pageSize ?? 50,
    };
  }

  async getBatches(_params: {
    warehouseId: string;
    itemId: string;
    includeZeroQty?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    return { items: [], total: 0 };
  }

  async getMovements(_params: {
    warehouseId: string;
    itemId: string;
    dateFrom?: string;
    dateTo?: string;
    movementType?: string;
    docType?: string;
    page?: number;
    pageSize?: number;
  }) {
    return { items: [], total: 0 };
  }
}
