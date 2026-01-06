import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { scopeStore } from './scope.store';

/**
 * Helper service for scope-related queries
 * Provides methods to get allowed brands, countries, warehouses for a given scope
 */
@Injectable()
export class ScopeHelperService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get allowed brand IDs for the current scope
   * Returns all brands linked to scope's legalEntityId through BrandCountry
   */
  async getAllowedBrandIds(legalEntityId: string): Promise<string[]> {
    const brandCountries = await this.prisma.brandCountry.findMany({
      where: { legalEntityId },
      select: { brandId: true },
    });
    return [...new Set(brandCountries.map((bc) => bc.brandId))];
  }

  /**
   * Get allowed country IDs for the current scope
   * Returns all countries linked to scope's legalEntityId through BrandCountry
   */
  async getAllowedCountryIds(legalEntityId: string): Promise<string[]> {
    const brandCountries = await this.prisma.brandCountry.findMany({
      where: { legalEntityId },
      select: { countryId: true },
    });
    return [...new Set(brandCountries.map((bc) => bc.countryId))];
  }

  /**
   * Get allowed warehouse IDs for the current scope
   * Returns warehouses in countries that belong to scope's legalEntityId
   */
  async getAllowedWarehouseIds(legalEntityId: string): Promise<string[]> {
    const countryIds = await this.getAllowedCountryIds(legalEntityId);
    if (countryIds.length === 0) {
      return [];
    }
    const warehouses = await this.prisma.warehouse.findMany({
      where: { countryId: { in: countryIds } },
      select: { id: true },
    });
    return warehouses.map((w) => w.id);
  }

  /**
   * Get current scope or throw
   */
  getScope() {
    const scope = scopeStore.getScope();
    if (!scope) {
      // Deny-by-default: endpoints that require scoping must not work outside ScopeInterceptor context.
      throw new ForbiddenException(
        'Request scope not found. Ensure ScopeInterceptor is enabled.',
      );
    }
    return scope;
  }
}


