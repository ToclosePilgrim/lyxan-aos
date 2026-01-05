import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { GetPnlDto } from './dto/get-pnl.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('finance')
@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('pnl')
  @ApiOperation({ summary: 'Get Profit & Loss report' })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, description: 'P&L report' })
  @ApiCookieAuth()
  getPnl(@Query() query: GetPnlDto) {
    return this.financeService.getPnl(query);
  }
}
