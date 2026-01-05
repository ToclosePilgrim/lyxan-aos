import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ok, fail, OsApiResponse } from './os-api.types';

@ApiTags('os-inventory')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('os/v1/inventory')
export class OsInventoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('balances')
  @ApiOperation({ summary: 'Inventory balances (OS API)' })
  async balances(
    @Query('warehouseId') warehouseId?: string,
    @Query('itemId') itemId?: string,
    @Query('productId') productId?: string,
    @Query('supplierItemId') supplierItemId?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ): Promise<
    OsApiResponse<{
      items: any[];
      total: number;
      page: number;
      pageSize: number;
    }>
  > {
    try {
      const where: any = {};
      if (warehouseId) where.warehouseId = warehouseId;
      if (productId) where.productId = productId;
      if (supplierItemId) where.supplierItemId = supplierItemId;
      if (itemId) {
        where.OR = [{ productId: itemId }, { supplierItemId: itemId }];
      }
      const take = Math.min(Number(pageSize) || 50, 200);
      const skip = ((Number(page) || 1) - 1) * take;
      const [items, total] = await Promise.all([
        this.prisma.inventoryBalance.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          take,
          skip,
        }),
        this.prisma.inventoryBalance.count({ where }),
      ]);
      return ok({ items, total, page: Number(page) || 1, pageSize: take });
    } catch (e: any) {
      return fail('BALANCES_FAILED', e?.message ?? 'Failed to fetch balances');
    }
  }

  @Get('batches')
  @ApiOperation({ summary: 'Inventory batches (OS API)' })
  async batches(
    @Query('warehouseId') warehouseId?: string,
    @Query('itemId') itemId?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ): Promise<
    OsApiResponse<{
      items: any[];
      total: number;
      page: number;
      pageSize: number;
    }>
  > {
    try {
      const where: any = {};
      if (warehouseId) where.warehouseId = warehouseId;
      if (itemId) where.itemId = itemId;
      const take = Math.min(Number(pageSize) || 50, 200);
      const skip = ((Number(page) || 1) - 1) * take;
      const [items, total] = await Promise.all([
        this.prisma.stockBatch.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        this.prisma.stockBatch.count({ where }),
      ]);
      return ok({ items, total, page: Number(page) || 1, pageSize: take });
    } catch (e: any) {
      return fail('BATCHES_FAILED', e?.message ?? 'Failed to fetch batches');
    }
  }

  @Get('movements')
  @ApiOperation({ summary: 'Inventory movements (OS API)' })
  async movements(
    @Query('warehouseId') warehouseId?: string,
    @Query('itemId') itemId?: string,
    @Query('docId') docId?: string,
    @Query('docType') docType?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ): Promise<
    OsApiResponse<{
      items: any[];
      total: number;
      page: number;
      pageSize: number;
    }>
  > {
    try {
      const where: any = {};
      if (warehouseId) where.warehouseId = warehouseId;
      if (itemId) where.itemId = itemId;
      if (docId) where.docId = docId;
      if (docType) where.docType = docType as any;
      const take = Math.min(Number(pageSize) || 50, 200);
      const skip = ((Number(page) || 1) - 1) * take;
      const [items, total] = await Promise.all([
        this.prisma.stockMovement.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        this.prisma.stockMovement.count({ where }),
      ]);
      return ok({ items, total, page: Number(page) || 1, pageSize: take });
    } catch (e: any) {
      return fail(
        'MOVEMENTS_FAILED',
        e?.message ?? 'Failed to fetch movements',
      );
    }
  }
}

