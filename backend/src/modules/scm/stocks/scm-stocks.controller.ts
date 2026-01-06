import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ScmStocksService } from './scm-stocks.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { GetStockLedgerDto } from './dto/get-stock-ledger.dto';
import { RecalcStockDto } from './dto/recalc-stock.dto';

@ApiTags('scm/stocks')
@Controller('scm/stocks')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class ScmStocksController {
  constructor(private readonly stocks: ScmStocksService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary:
      'Legacy stocks list (deprecated): read-model over InventoryBalance (canonical)',
  })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200 })
  async list(
    @Query('warehouseId') warehouseId?: string,
    @Query('search') search?: string,
  ) {
    return this.stocks.listStocks({ warehouseId, search });
  }

  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary:
      'Legacy stocks summary (deprecated): aggregated read-model over InventoryBalance (canonical)',
  })
  async summary() {
    return this.stocks.getSummary();
  }

  @Get('ledger')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Legacy stock ledger (deprecated): backed by StockMovement',
  })
  async ledger(@Query() dto: GetStockLedgerDto) {
    return this.stocks.getLedger(dto);
  }

  @Post('adjust')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary:
      'Adjust stock via canonical inventory movements (creates StockMovement + InventoryBalance updates)',
  })
  async adjust(@Body() dto: AdjustStockDto) {
    return this.stocks.adjust(dto);
  }

  @Post('recalculate')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({
    summary:
      'Deprecated: ScmStock recalculation is removed (ScmStock is not a SoT anymore)',
  })
  async recalculate(@Body() _dto: RecalcStockDto) {
    // Intentionally disabled: there is no legacy ScmStock table anymore.
    return { ok: true, deprecated: true, message: 'ScmStock is removed' };
  }

  @Patch(':skuId')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({
    summary:
      'Legacy write endpoint (disabled): use /scm/stocks/adjust instead',
  })
  @ApiParam({ name: 'skuId', description: 'Legacy skuId/itemId' })
  async updateLegacy(@Param('skuId') _skuId: string, @Body() _body: any) {
    return this.stocks.updateLegacyStock();
  }
}

