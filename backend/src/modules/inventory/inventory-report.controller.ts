import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InventoryReportService } from './inventory-report.service';

@ApiTags('inventory/report')
@Controller('inventory/report')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class InventoryReportController {
  constructor(private readonly report: InventoryReportService) {}

  @Get('balances')
  @ApiOperation({ summary: 'Inventory balances (canonical)' })
  async balances(
    @Query('warehouseId') warehouseId?: string,
    @Query('itemId') itemId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.report.getBalances({
      warehouseId,
      itemId,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 50,
    });
  }
}
