import { Controller, Get, Logger, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InventoryReportService } from '../inventory/inventory-report.service';
import { ok, fail, OsApiResponse } from './os-api.types';

@ApiTags('os-inventory')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('os/v1/inventory')
export class OsInventoryController {
  private readonly logger = new Logger(OsInventoryController.name);

  constructor(private readonly report: InventoryReportService) {}

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
      this.logger.warn(
        'deprecated_endpoint: os/v1/inventory/balances -> use inventory/report/balances (alias via InventoryReportService)',
      );

      // Backward compatibility for old query params:
      // InventoryBalance is keyed by (warehouseId, itemId) now; productId/supplierItemId are treated as itemId hints.
      const effectiveItemId = itemId ?? productId ?? supplierItemId;

      const res = await this.report.getBalances({
        warehouseId,
        itemId: effectiveItemId,
        page: Number(page) || 1,
        pageSize: Number(pageSize) || 50,
      });
      return ok(res);
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
      this.logger.warn(
        'deprecated_endpoint: os/v1/inventory/batches -> use inventory/report/batches (alias via InventoryReportService)',
      );
      if (!warehouseId || !itemId) {
        return fail(
          'BAD_REQUEST',
          'warehouseId and itemId are required',
          { warehouseId: warehouseId ?? null, itemId: itemId ?? null },
        );
      }
      const res = await this.report.getBatches({
        warehouseId,
        itemId,
        page: Number(page) || 1,
        pageSize: Number(pageSize) || 50,
      });
      return ok(res);
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
      this.logger.warn(
        'deprecated_endpoint: os/v1/inventory/movements -> use inventory/report/movements (alias via InventoryReportService)',
      );

      // docId/docType are legacy filters; canonical report supports docType but not docId.
      // We intentionally ignore docId here to avoid exposing a second-path filtering contract.
      if (docId) {
        this.logger.warn(
          'deprecated_param: os/v1/inventory/movements?docId is ignored; use canonical filters',
        );
      }

      const res = await this.report.getMovements({
        warehouseId,
        itemId,
        docType,
        page: Number(page) || 1,
        pageSize: Number(pageSize) || 50,
      });
      return ok(res);
    } catch (e: any) {
      return fail(
        'MOVEMENTS_FAILED',
        e?.message ?? 'Failed to fetch movements',
      );
    }
  }
}




