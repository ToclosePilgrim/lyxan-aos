import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('warehouses/:warehouseId/balances')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get inventory balances for warehouse' })
  @ApiParam({ name: 'warehouseId', description: 'Warehouse ID' })
  @ApiResponse({ status: 200, description: 'List of inventory balances' })
  @ApiCookieAuth()
  async getBalancesForWarehouse(@Param('warehouseId') warehouseId: string) {
    return this.inventoryService.getBalanceForWarehouse(warehouseId);
  }

  @Get('supplies/:supplyId/transactions')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get inventory transactions for supply' })
  @ApiParam({ name: 'supplyId', description: 'Supply ID' })
  @ApiResponse({ status: 200, description: 'List of inventory transactions' })
  @ApiCookieAuth()
  async getTransactionsForSupply(@Param('supplyId') supplyId: string) {
    return this.inventoryService.getTransactionsForSupply(supplyId);
  }
}




