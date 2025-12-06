import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(dateFrom?: string, dateTo?: string) {
    // Calculate date range (default: last 30 days)
    let startDate: Date;
    let endDate: Date;

    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom);
      endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
    } else {
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    // ============ Sales (from FinanceReport) ============
    const financeReports = await this.prisma.financeReport.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        sku: {
          select: {
            cost: true,
          },
        },
      },
    });

    const totalRevenue = financeReports.reduce(
      (sum, report) => sum + report.revenue,
      0,
    );
    const totalOrders = financeReports.reduce(
      (sum, report) => sum + report.quantity,
      0,
    );
    const avgCheck = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalRefunds = financeReports.reduce(
      (sum, report) => sum + (report.refunds || 0),
      0,
    );

    // ============ Margin (from FinanceReport + Sku.cost) ============
    const totalCost = financeReports.reduce((sum, report) => {
      const cost = report.sku.cost || 0;
      return sum + cost * report.quantity;
    }, 0);

    const grossMargin = totalRevenue - totalRefunds - totalCost;
    const grossMarginPercent =
      totalRevenue > 0 ? ((grossMargin / totalRevenue) * 100) : 0;

    // ============ Advertising (from AdStats) ============
    const adStats = await this.prisma.adStats.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalSpend = adStats.reduce(
      (sum, stat) => sum + (stat.spend || 0),
      0,
    );
    const adRevenue = adStats.reduce(
      (sum, stat) => sum + (stat.revenue || 0),
      0,
    );
    // ROAS = revenue from ads / spend on ads
    const roas = totalSpend > 0 ? adRevenue / totalSpend : 0;

    // ============ Stocks (from Stock) ============
    const stocks = await this.prisma.stock.findMany({
      include: {
        sku: {
          select: {
            id: true,
          },
        },
      },
    });

    const totalSkus = new Set(stocks.map((stock) => stock.skuId)).size;
    const totalQuantity = stocks.reduce(
      (sum, stock) => sum + stock.quantity,
      0,
    );
    const lowStockSkus = stocks.filter((stock) => stock.quantity < 10).length;

    // ============ Support (from Review) ============
    const reviews = await this.prisma.review.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalReviews = reviews.length;
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) /
          reviews.length
        : 0;
    const negativeReviews = reviews.filter((review) => review.rating <= 2)
      .length;

    return {
      sales: {
        totalRevenue,
        totalOrders,
        avgCheck,
        totalRefunds,
      },
      margin: {
        totalCost,
        grossMargin,
        grossMarginPercent,
      },
      advertising: {
        totalSpend,
        roas,
      },
      stocks: {
        totalSkus,
        totalQuantity,
        lowStockSkus,
      },
      support: {
        totalReviews,
        avgRating,
        negativeReviews,
      },
    };
  }
}
