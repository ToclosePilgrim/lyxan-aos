import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ScmStocksService } from './scm-stocks.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('scm/stock')
@Controller('scm')
@UseGuards(JwtAuthGuard)
export class ScmStockBatchesController {
  constructor(private readonly scmStocksService: ScmStocksService) {}

  @Get('warehouses/:warehouseId/stock')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get stock batches for warehouse' })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse ID' })
  @ApiResponse({ status: 200, description: 'List of stock batches' })
  @ApiCookieAuth()
  async getWarehouseStock(@Param('warehouseId') warehouseId: string) {
    return this.scmStocksService.getBatchesByWarehouse(warehouseId);
  }

  @Get('items/:itemId/stock')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get stock batches for item across warehouses' })
  @ApiParam({
    name: 'itemId',
    description: 'Item ID (supplierItemId or product)',
  })
  @ApiResponse({ status: 200, description: 'List of stock batches' })
  @ApiCookieAuth()
  async getItemStock(@Param('itemId') itemId: string) {
    return this.scmStocksService.getBatchesByItem(itemId);
  }
}




