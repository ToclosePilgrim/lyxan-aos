import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ScmStocksService } from './scm-stocks.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('scm/stocks')
@Controller('scm/stocks')
@UseGuards(JwtAuthGuard)
export class ScmStocksController {
  constructor(private readonly scmStocksService: ScmStocksService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get list of stocks' })
  @ApiQuery({ name: 'warehouseId', required: false, description: 'Filter by warehouse ID' })
  @ApiQuery({ name: 'supplierItemId', required: false, description: 'Filter by supplier item ID' })
  @ApiQuery({ name: 'scmProductId', required: false, description: 'Filter by SCM product ID' })
  @ApiQuery({ name: 'productId', required: false, description: 'Filter by product ID (alias for scmProductId)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by product/item name' })
  @ApiResponse({ status: 200, description: 'List of stocks' })
  @ApiCookieAuth()
  async findAll(
    @Query('warehouseId') warehouseId?: string,
    @Query('supplierItemId') supplierItemId?: string,
    @Query('scmProductId') scmProductId?: string,
    @Query('productId') productId?: string,
    @Query('search') search?: string,
  ) {
    return this.scmStocksService.findAll({
      warehouseId,
      supplierItemId,
      scmProductId: scmProductId || productId,
      search,
    });
  }

  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Get stock summary grouped by item/product',
    description: 'Returns aggregated stock quantities without warehouse breakdown',
  })
  @ApiResponse({ status: 200, description: 'Stock summary' })
  @ApiCookieAuth()
  async getSummary() {
    return this.scmStocksService.getSummary();
  }
}

