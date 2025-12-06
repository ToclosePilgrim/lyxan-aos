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
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get analytics dashboard data' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({
    status: 200,
    description: 'Analytics dashboard data',
    schema: {
      example: {
        sales: {
          totalRevenue: 142000,
          totalOrders: 820,
          avgCheck: 173.17,
          totalRefunds: 3200,
        },
        margin: {
          totalCost: 67000,
          grossMargin: 72000,
          grossMarginPercent: 50.7,
        },
        advertising: {
          totalSpend: 22000,
          roas: 6.45,
        },
        stocks: {
          totalSkus: 58,
          totalQuantity: 12340,
          lowStockSkus: 7,
        },
        support: {
          totalReviews: 238,
          avgRating: 4.3,
          negativeReviews: 22,
        },
      },
    },
  })
  @ApiCookieAuth()
  getDashboard(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.analyticsService.getDashboard(dateFrom, dateTo);
  }
}
