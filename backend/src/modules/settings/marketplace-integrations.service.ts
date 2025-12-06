import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateMarketplaceIntegrationDto } from './dto/create-marketplace-integration.dto';
import { UpdateMarketplaceIntegrationDto } from './dto/update-marketplace-integration.dto';
import { TestConnectionDto } from './dto/test-connection.dto';
import { IntegrationStatus, LogSource } from '@prisma/client';
import { IntegrationLogsService } from '../integration-logs/integration-logs.service';
import {
  OZON_SELLER_BASE_URL,
  OZON_PERFORMANCE_BASE_URL,
} from '../../config/ozon.config';

@Injectable()
export class MarketplaceIntegrationsService {
  constructor(
    private prisma: PrismaService,
    private readonly integrationLogs: IntegrationLogsService,
  ) {}

  async findAll(filters?: {
    brandId?: string;
    countryId?: string;
    marketplaceCode?: string;
  }) {
    const where: Prisma.MarketplaceIntegrationWhereInput = {};

    if (filters?.brandId) {
      where.brandId = filters.brandId;
    }

    if (filters?.countryId) {
      where.countryId = filters.countryId;
    }

    if (filters?.marketplaceCode) {
      where.marketplace = {
        code: filters.marketplaceCode,
      };
    }

    const integrations = await this.prisma.marketplaceIntegration.findMany({
      where,
      include: {
        marketplace: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        country: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return integrations.map((integration) => ({
      id: integration.id,
      name: integration.name,
      marketplace: integration.marketplace,
      brand: integration.brand,
      country: integration.country,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt,
    }));
  }

  async findOne(id: string) {
    const integration = await this.prisma.marketplaceIntegration.findUnique({
      where: { id },
      include: {
        marketplace: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        country: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!integration) {
      throw new NotFoundException(`Marketplace integration with ID ${id} not found`);
    }

    return {
      id: integration.id,
      name: integration.name,
      marketplace: integration.marketplace,
      brand: integration.brand,
      country: integration.country,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt,
      credentials: {
        ozonSellerClientId: integration.ozonSellerClientId,
        ozonSellerHasToken: !!integration.ozonSellerToken,
        ozonPerfClientId: integration.ozonPerfClientId,
        ozonPerfHasSecret: !!integration.ozonPerfClientSecret,
      },
    };
  }

  async create(dto: CreateMarketplaceIntegrationDto) {
    // Get marketplace
    const marketplace = await this.prisma.marketplace.findUnique({
      where: { id: dto.marketplaceId },
    });

    if (!marketplace) {
      throw new NotFoundException(`Marketplace with ID ${dto.marketplaceId} not found`);
    }

    // Get brand
    const brand = await this.prisma.brand.findUnique({
      where: { id: dto.brandId },
      include: {
        countries: {
          include: {
            country: true,
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${dto.brandId} not found`);
    }

    // Determine countryId
    let countryId = dto.countryId;

    if (!countryId) {
      // Try to get country from brand's countries
      const brandCountry = brand.countries[0];
      if (!brandCountry) {
        throw new BadRequestException(
          'Brand has no associated countries. Please specify countryId explicitly.',
        );
      }
      countryId = brandCountry.countryId;
    }

    // Verify country exists
    const country = await this.prisma.country.findUnique({
      where: { id: countryId },
    });

    if (!country) {
      throw new NotFoundException(`Country with ID ${countryId} not found`);
    }

    // Check uniqueness
    const existing = await this.prisma.marketplaceIntegration.findUnique({
      where: {
        uniq_marketplace_brand_country: {
          marketplaceId: dto.marketplaceId,
          brandId: dto.brandId,
          countryId: countryId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Integration for marketplace ${marketplace.name}, brand ${brand.name}, and country ${country.name} already exists`,
      );
    }

    // Generate name
    const name = `${marketplace.name} – ${brand.name} – ${country.name}`;

    // Create integration
    const integration = await this.prisma.marketplaceIntegration.create({
      data: {
        name,
        marketplaceId: dto.marketplaceId,
        brandId: dto.brandId,
        countryId: countryId,
        status: IntegrationStatus.ACTIVE,
      },
      include: {
        marketplace: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        country: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    // Log creation
    await this.integrationLogs.info('Marketplace integration created', {
      source: LogSource.MARKETPLACE_INTEGRATION,
      integrationId: integration.id,
      details: {
        marketplaceId: integration.marketplaceId,
        brandId: integration.brandId,
        countryId: integration.countryId,
        name: integration.name,
      },
    });

    return {
      id: integration.id,
      name: integration.name,
      marketplace: integration.marketplace,
      brand: integration.brand,
      country: integration.country,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt,
    };
  }

  async update(id: string, dto: UpdateMarketplaceIntegrationDto) {
    const integration = await this.prisma.marketplaceIntegration.findUnique({
      where: { id },
    });

    if (!integration) {
      throw new NotFoundException(`Marketplace integration with ID ${id} not found`);
    }

    const updateData: Prisma.MarketplaceIntegrationUpdateInput = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }

    if (dto.ozonSellerClientId !== undefined) {
      updateData.ozonSellerClientId = dto.ozonSellerClientId;
    }

    // Handle token: if null/empty string, clear it; if provided, update it
    if (dto.ozonSellerToken !== undefined) {
      updateData.ozonSellerToken = dto.ozonSellerToken || null;
    }

    if (dto.ozonPerfClientId !== undefined) {
      updateData.ozonPerfClientId = dto.ozonPerfClientId;
    }

    // Handle secret: if null/empty string, clear it; if provided, update it
    if (dto.ozonPerfClientSecret !== undefined) {
      updateData.ozonPerfClientSecret = dto.ozonPerfClientSecret || null;
    }

    const updated = await this.prisma.marketplaceIntegration.update({
      where: { id },
      data: updateData,
      include: {
        marketplace: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        country: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    // Log update
    await this.integrationLogs.info('Marketplace integration updated', {
      source: LogSource.MARKETPLACE_INTEGRATION,
      integrationId: updated.id,
      details: {
        nameChanged: dto.name !== undefined,
        statusChanged: dto.status !== undefined,
        credentialsUpdated:
          dto.ozonSellerClientId !== undefined ||
          dto.ozonSellerToken !== undefined ||
          dto.ozonPerfClientId !== undefined ||
          dto.ozonPerfClientSecret !== undefined,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      marketplace: updated.marketplace,
      brand: updated.brand,
      country: updated.country,
      status: updated.status,
      lastSyncAt: updated.lastSyncAt,
      credentials: {
        ozonSellerClientId: updated.ozonSellerClientId,
        ozonSellerHasToken: !!updated.ozonSellerToken,
        ozonPerfClientId: updated.ozonPerfClientId,
        ozonPerfHasSecret: !!updated.ozonPerfClientSecret,
      },
    };
  }

  async testConnection(id: string, dto?: TestConnectionDto) {
    const integration = await this.prisma.marketplaceIntegration.findUnique({
      where: { id },
      include: {
        marketplace: true,
      },
    });

    if (!integration) {
      throw new NotFoundException(`Marketplace integration with ID ${id} not found`);
    }

    // Use credentials from DTO if provided, otherwise use saved credentials from DB
    const ozonSellerClientId =
      dto?.ozonSellerClientId ?? integration.ozonSellerClientId;
    const ozonSellerToken = dto?.ozonSellerToken ?? integration.ozonSellerToken;
    const ozonPerfClientId =
      dto?.ozonPerfClientId ?? integration.ozonPerfClientId;
    const ozonPerfClientSecret =
      dto?.ozonPerfClientSecret ?? integration.ozonPerfClientSecret;

    // Check if credentials are present
    const errors: string[] = [];

    if (integration.marketplace?.code.toLowerCase() === 'ozon') {
      if (!ozonSellerClientId || !ozonSellerToken) {
        errors.push('Missing Ozon Seller credentials.');
      }

      if (!ozonPerfClientId || !ozonPerfClientSecret) {
        errors.push('Missing Ozon Performance credentials.');
      }
    }

    if (errors.length > 0) {
      // Update status to ERROR
      await this.prisma.marketplaceIntegration.update({
        where: { id },
        data: {
          status: IntegrationStatus.ERROR,
        },
      });

      // Log test connection failure
      await this.integrationLogs.warn(
        'Marketplace integration testConnection failed: missing credentials',
        {
          source: LogSource.MARKETPLACE_INTEGRATION,
          integrationId: integration.id,
          details: {
            marketplaceCode: integration.marketplace?.code,
            missingSeller: !ozonSellerClientId || !ozonSellerToken,
            missingPerf: !ozonPerfClientId || !ozonPerfClientSecret,
            errors: errors,
          },
        },
      );

      return {
        ok: false,
        status: IntegrationStatus.ERROR,
        message: errors.join(' '),
      };
    }

    // TODO: In the future, make actual API calls to Ozon to validate credentials
    // For now, we just validate that credentials are present and not empty
    // Example future implementation:
    // try {
    //   // Test Seller API
    //   const sellerResponse = await fetch(`${OZON_SELLER_BASE_URL}/v1/product/info`, {
    //     method: 'POST',
    //     headers: {
    //       'Client-Id': ozonSellerClientId,
    //       'Api-Key': ozonSellerToken,
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({ product_id: [] }),
    //   });
    //   if (!sellerResponse.ok) {
    //     throw new Error(`Ozon Seller API request failed: ${sellerResponse.status} ${sellerResponse.statusText}`);
    //   }
    //
    //   // Test Performance API
    //   const perfResponse = await fetch(`${OZON_PERFORMANCE_BASE_URL}/api/client/token`, {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //       client_id: ozonPerfClientId,
    //       client_secret: ozonPerfClientSecret,
    //     }),
    //   });
    //   if (!perfResponse.ok) {
    //     throw new Error(`Ozon Performance API request failed: ${perfResponse.status} ${perfResponse.statusText}`);
    //   }
    // } catch (error: any) {
    //   await this.prisma.marketplaceIntegration.update({
    //     where: { id },
    //     data: { status: IntegrationStatus.ERROR },
    //   });
    //   await this.integrationLogs.error('Marketplace integration testConnection failed: API error', {
    //     source: LogSource.MARKETPLACE_INTEGRATION,
    //     integrationId: integration.id,
    //     details: { error: error.message },
    //   });
    //   return {
    //     ok: false,
    //     status: IntegrationStatus.ERROR,
    //     message: error.message || 'Connection test failed',
    //   };
    // }

    // Success: update lastSyncAt and set status to ACTIVE
    await this.prisma.marketplaceIntegration.update({
      where: { id },
      data: {
        status: IntegrationStatus.ACTIVE,
        lastSyncAt: new Date(),
      },
    });

    // Log test connection success
    await this.integrationLogs.info('Marketplace integration testConnection success', {
      source: LogSource.MARKETPLACE_INTEGRATION,
      integrationId: integration.id,
      details: {
        status: 'ACTIVE',
        marketplaceCode: integration.marketplace?.code,
        sellerBaseUrl: OZON_SELLER_BASE_URL,
        performanceBaseUrl: OZON_PERFORMANCE_BASE_URL,
      },
    });

    return {
      ok: true,
      status: IntegrationStatus.ACTIVE,
      message: 'Connection test passed. Credentials look valid (not empty).',
    };
  }
}

