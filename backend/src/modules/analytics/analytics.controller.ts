import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AnalyticsDashboardDto } from './dto/analytics-dashboard.dto';
import { AnalyticsInventorySnapshotDto } from './dto/analytics-inventory-snapshot.dto';
import { AnalyticsTopProductsDto } from './dto/analytics-top-products.dto';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get analytics dashboard data' })
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
  @ApiQuery({ name: 'countryId', required: true })
  @ApiQuery({ name: 'brandId', required: true })
  @ApiQuery({ name: 'marketplaceId', required: false })
  @ApiResponse({
    status: 200,
    description: 'Analytics dashboard data',
  })
  @ApiCookieAuth()
  getDashboard(@Query() dto: AnalyticsDashboardDto) {
    return this.analyticsService.getDashboard(dto);
  }

  @Get('inventory-snapshot')
  @ApiOperation({
    summary: 'Inventory snapshot (on-hand) from InventoryBalance - scoped',
  })
  @ApiQuery({
    name: 'asOf',
    required: false,
    description: 'Date (reserved for future)',
  })
  @ApiQuery({ name: 'countryId', required: true })
  @ApiQuery({ name: 'brandId', required: true })
  @ApiResponse({ status: 200 })
  @ApiCookieAuth()
  getInventorySnapshot(@Query() dto: AnalyticsInventorySnapshotDto) {
    return this.analyticsService.getInventorySnapshot(dto);
  }

  @Get('top-products')
  @ApiOperation({
    summary: 'Top products (best-effort) from AccountingEntry - scoped',
  })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'countryId', required: true })
  @ApiQuery({ name: 'brandId', required: true })
  @ApiQuery({ name: 'marketplaceId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'lang', required: false })
  @ApiResponse({ status: 200 })
  @ApiCookieAuth()
  getTopProducts(@Query() dto: AnalyticsTopProductsDto) {
    return this.analyticsService.getTopProducts(dto);
  }
}
