import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../database/prisma.service';
import { ok, fail, OsApiResponse } from './os-api.types';

@ApiTags('os-dwh')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('os/v1')
export class OsDwhController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('dwh/refresh')
  @ApiOperation({
    summary: 'Trigger DWH refresh (raw/core/marts). Placeholder trigger.',
  })
  async refresh(
    @Body() body: { raw?: boolean; core?: boolean; marts?: boolean },
  ): Promise<OsApiResponse<{ status: string; requested: any }>> {
    return ok({
      status: 'queued (placeholder)',
      requested: {
        raw: body?.raw ?? true,
        core: body?.core ?? true,
        marts: body?.marts ?? true,
      },
    });
  }

  @Post('dwh/query')
  @ApiOperation({ summary: 'Execute DWH query (disabled here, use BigQuery).' })
  async query(): Promise<OsApiResponse<never>> {
    return fail(
      'DWH_QUERY_DISABLED',
      'Direct DWH queries are disabled in this environment. Use BigQuery directly.',
    );
  }

  @Get('export/raw')
  @ApiOperation({
    summary:
      'Export raw table snapshot (incremental by updatedSince if available).',
  })
  async exportRaw(
    @Query('table') table: string,
    @Query('updatedSince') updatedSince?: string,
    @Query('limit') limit = '1000',
  ): Promise<OsApiResponse<{ items: any[] }>> {
    const maxLimit = 2000;
    const take = Math.min(Number(limit) || 1000, maxLimit);
    const sinceDate = updatedSince ? new Date(updatedSince) : undefined;
    const map: Record<string, (where: any) => Promise<any[]>> = {
      scm_supply: (where) =>
        (this.prisma as any).scmSupply.findMany({ where, take }),
      scm_supply_item: (where) =>
        (this.prisma as any).scmSupplyItem.findMany({ where, take }),
      scm_product: (where) =>
        (this.prisma as any).scmProduct.findMany({ where, take }),
      scm_warehouse: (where) =>
        (this.prisma as any).warehouse.findMany({ where, take }),
      stock_batch: (where) =>
        (this.prisma as any).stockBatch.findMany({ where, take }),
      stock_movement: (where) =>
        (this.prisma as any).stockMovement.findMany({ where, take }),
      inventory_transaction: (where) =>
        (this.prisma as any).inventoryTransaction.findMany({ where, take }),
      inventory_balance: (where) =>
        (this.prisma as any).inventoryBalance.findMany({ where, take }),
      sales_document: (where) =>
        (this.prisma as any).salesDocument.findMany({ where, take }),
      sales_document_line: (where) =>
        (this.prisma as any).salesDocumentLine.findMany({ where, take }),
      financial_document: (where) =>
        (this.prisma as any).financialDocument.findMany({ where, take }),
      accounting_entry: (where) =>
        (this.prisma as any).accountingEntry.findMany({ where, take }),
      os_event: (where) =>
        (this.prisma as any).osEvent.findMany({ where, take }),
    };

    const fn = map[table];
    if (!fn) {
      return fail('INVALID_TABLE', 'Table not allowed for export', { table });
    }

    const where: any = {};
    if (sinceDate && !isNaN(sinceDate.getTime())) {
      // Only apply if table has updatedAt column; many do. If not, it will be ignored by Prisma.
      where.updatedAt = { gt: sinceDate as any };
    }

    const items = await fn(where);
    return ok({ items });
  }
}

