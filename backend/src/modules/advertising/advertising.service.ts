import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { CreateAdStatsDto } from './dto/create-adstats.dto';
import { UpdateAdStatsDto } from './dto/update-adstats.dto';

@Injectable()
export class AdvertisingService {
  constructor(private prisma: PrismaService) {}

  // ============ AdCampaign ============

  async getCampaigns(filters?: { status?: string; search?: string }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.name = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }

    const campaigns = await this.prisma.adCampaign.findMany({
      where,
      include: {
        marketplace: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        stats: {
          select: {
            spend: true,
            revenue: true,
            orders: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate aggregates for each campaign
    return campaigns.map((campaign) => {
      const totalSpend = campaign.stats.reduce(
        (sum, stat) => sum + (stat.spend || 0),
        0,
      );
      const totalRevenue = campaign.stats.reduce(
        (sum, stat) => sum + (stat.revenue || 0),
        0,
      );
      const totalOrders = campaign.stats.reduce(
        (sum, stat) => sum + (stat.orders || 0),
        0,
      );

      return {
        ...campaign,
        totalSpend,
        totalRevenue,
        totalOrders,
      };
    });
  }

  async getCampaignById(id: string, dateFrom?: string, dateTo?: string) {
    const campaign = await this.prisma.adCampaign.findUnique({
      where: { id },
      include: {
        marketplace: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    // Get stats with date filter
    const statsWhere: any = { campaignId: id };

    if (dateFrom || dateTo) {
      statsWhere.date = {};
      if (dateFrom) {
        statsWhere.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        const dateToEnd = new Date(dateTo);
        dateToEnd.setHours(23, 59, 59, 999);
        statsWhere.date.lte = dateToEnd;
      }
    } else {
      // Default: last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      statsWhere.date = {
        gte: thirtyDaysAgo,
      };
    }

    const stats = await this.prisma.adStats.findMany({
      where: statsWhere,
      orderBy: { date: 'desc' },
    });

    // Calculate aggregates
    const totalSpend = stats.reduce((sum, stat) => sum + (stat.spend || 0), 0);
    const totalRevenue = stats.reduce(
      (sum, stat) => sum + (stat.revenue || 0),
      0,
    );
    const totalOrders = stats.reduce(
      (sum, stat) => sum + (stat.orders || 0),
      0,
    );

    const roas = totalSpend > 0 ? totalRevenue / totalSpend : null;

    return {
      ...campaign,
      stats,
      aggregates: {
        totalSpend,
        totalRevenue,
        totalOrders,
        roas,
      },
    };
  }

  async createCampaign(dto: CreateCampaignDto) {
    // Check if marketplace exists
    const marketplace = await this.prisma.marketplace.findUnique({
      where: { id: dto.marketplaceId },
    });

    if (!marketplace) {
      throw new NotFoundException(
        `Marketplace with ID ${dto.marketplaceId} not found`,
      );
    }

    return this.prisma.adCampaign.create({
      data: {
        marketplaceId: dto.marketplaceId,
        name: dto.name,
        status: dto.status || 'ACTIVE',
        budget: dto.budget,
      },
      include: {
        marketplace: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async updateCampaign(id: string, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.adCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    return this.prisma.adCampaign.update({
      where: { id },
      data: dto,
      include: {
        marketplace: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async deleteCampaign(id: string) {
    const campaign = await this.prisma.adCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    await this.prisma.adCampaign.delete({
      where: { id },
    });

    return {
      message: `Campaign with ID ${id} has been deleted`,
    };
  }

  // ============ AdStats ============

  async createAdStats(dto: CreateAdStatsDto) {
    // Check if campaign exists
    const campaign = await this.prisma.adCampaign.findUnique({
      where: { id: dto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(
        `Campaign with ID ${dto.campaignId} not found`,
      );
    }

    // Validate date
    const date = new Date(dto.date);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    // Check if stats already exist for this date
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setDate(dateEnd.getDate() + 1);
    dateEnd.setHours(0, 0, 0, 0);

    const existingStats = await this.prisma.adStats.findFirst({
      where: {
        campaignId: dto.campaignId,
        date: {
          gte: dateStart,
          lt: dateEnd,
        },
      },
    });

    if (existingStats) {
      throw new ConflictException(
        `Statistics for this date already exist. Use PATCH to update.`,
      );
    }

    return this.prisma.adStats.create({
      data: {
        campaignId: dto.campaignId,
        date,
        impressions: dto.impressions || null,
        clicks: dto.clicks || null,
        spend: dto.spend || null,
        orders: dto.orders || null,
        revenue: dto.revenue || null,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateAdStats(id: string, dto: UpdateAdStatsDto) {
    const stats = await this.prisma.adStats.findUnique({
      where: { id },
    });

    if (!stats) {
      throw new NotFoundException(`AdStats with ID ${id} not found`);
    }

    return this.prisma.adStats.update({
      where: { id },
      data: dto,
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteAdStats(id: string) {
    const stats = await this.prisma.adStats.findUnique({
      where: { id },
    });

    if (!stats) {
      throw new NotFoundException(`AdStats with ID ${id} not found`);
    }

    await this.prisma.adStats.delete({
      where: { id },
    });

    return {
      message: `AdStats with ID ${id} has been deleted`,
    };
  }
}
