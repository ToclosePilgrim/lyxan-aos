import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateFinanceReportDto } from './dto/create-finance-report.dto';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  // ============ Finance Reports ============

  async getReports(filters?: {
    skuId?: string;
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters?.skuId) {
      where.skuId = filters.skuId;
    }

    if (filters?.date) {
      const date = new Date(filters.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      where.date = {
        gte: date,
        lt: nextDay,
      };
    } else {
      if (filters?.dateFrom) {
        where.date = {
          ...where.date,
          gte: new Date(filters.dateFrom),
        };
      }

      if (filters?.dateTo) {
        const dateTo = new Date(filters.dateTo);
        dateTo.setHours(23, 59, 59, 999); // Include full day

        where.date = {
          ...where.date,
          lte: dateTo,
        };
      }
    }

    const [reports, total] = await Promise.all([
      this.prisma.financeReport.findMany({
        where,
        include: {
          sku: {
            include: {
              product: {
                include: {
                  brand: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
        take: Math.min(Number(filters?.limit) || 50, 100),
        skip: filters?.offset,
      }),
      this.prisma.financeReport.count({ where }),
    ]);

    const take = Math.min(Number(filters?.limit) || 50, 100);

    return {
      data: reports,
      total,
      limit: take,
      offset: filters?.offset,
    };
  }

  async createReport(dto: CreateFinanceReportDto) {
    // Check if SKU exists
    const sku = await this.prisma.sku.findUnique({
      where: { id: dto.skuId },
    });

    if (!sku) {
      throw new NotFoundException(`SKU with ID ${dto.skuId} not found`);
    }

    // Validate date
    const date = new Date(dto.date);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // Create finance report
    return this.prisma.financeReport.create({
      data: {
        skuId: dto.skuId,
        date,
        quantity: dto.quantity,
        revenue: dto.revenue,
        commission: dto.commission || 0,
        refunds: dto.refunds || 0,
      },
      include: {
        sku: {
          include: {
            product: {
              include: {
                brand: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // ============ P&L ============

  async getPnl(dateFrom?: string, dateTo?: string) {
    const where: any = {};

    if (dateFrom || dateTo) {
      where.date = {};

      if (dateFrom) {
        where.date.gte = new Date(dateFrom);
      }

      if (dateTo) {
        const dateToEnd = new Date(dateTo);
        dateToEnd.setHours(23, 59, 59, 999); // Include full day
        where.date.lte = dateToEnd;
      }
    }

    // Get all reports with SKU cost
    const reports = await this.prisma.financeReport.findMany({
      where,
      include: {
        sku: {
          select: {
            id: true,
            code: true,
            cost: true,
          },
        },
      },
    });

    // Calculate aggregates
    let totalRevenue = 0;
    let totalCommission = 0;
    let totalRefunds = 0;
    let totalCost = 0;

    for (const report of reports) {
      totalRevenue += report.revenue;
      totalCommission += report.commission;
      totalRefunds += report.refunds;

      // Calculate cost if SKU has cost
      if (report.sku.cost !== null && report.sku.cost !== undefined) {
        totalCost += report.sku.cost * report.quantity;
      }
    }

    const grossMargin = totalRevenue - totalCommission - totalRefunds - totalCost;
    const grossMarginPercent =
      totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCommission,
      totalRefunds,
      totalCost,
      grossMargin,
      grossMarginPercent,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    };
  }
}
