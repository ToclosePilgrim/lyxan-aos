import {
  Controller,
  Get,
  Post,
  Body,
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
import { FinanceService } from './finance.service';
import { CreateFinanceReportDto } from './dto/create-finance-report.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('finance')
@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('reports')
  @ApiOperation({ summary: 'Get finance reports' })
  @ApiQuery({ name: 'skuId', required: false, description: 'Filter by SKU ID' })
  @ApiQuery({ name: 'date', required: false, description: 'Filter by specific date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Filter from date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'Filter to date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit results', type: Number })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset results', type: Number })
  @ApiResponse({ status: 200, description: 'List of finance reports' })
  @ApiCookieAuth()
  getReports(
    @Query('skuId') skuId?: string,
    @Query('date') date?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const filters: any = {};
    if (skuId) filters.skuId = skuId;
    if (date) filters.date = date;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (limit) filters.limit = parseInt(limit, 10);
    if (offset) filters.offset = parseInt(offset, 10);

    return this.financeService.getReports(filters);
  }

  @Post('reports')
  @ApiOperation({ summary: 'Create a finance report' })
  @ApiResponse({ status: 201, description: 'Finance report created successfully' })
  @ApiResponse({ status: 404, description: 'SKU not found' })
  @ApiResponse({ status: 400, description: 'Invalid date format' })
  @ApiCookieAuth()
  createReport(@Body() createFinanceReportDto: CreateFinanceReportDto) {
    return this.financeService.createReport(createFinanceReportDto);
  }

  @Get('pnl')
  @ApiOperation({ summary: 'Get Profit & Loss report' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'P&L report' })
  @ApiCookieAuth()
  getPnl(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.financeService.getPnl(dateFrom, dateTo);
  }
}
