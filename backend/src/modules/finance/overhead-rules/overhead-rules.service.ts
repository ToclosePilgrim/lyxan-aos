import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  OverheadAllocationMethod,
  OverheadScope,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CreateOverheadRuleDto } from './dto/create-overhead-rule.dto';
import { UpdateOverheadRuleDto } from './dto/update-overhead-rule.dto';
import { FilterOverheadRulesDto } from './dto/filter-overhead-rules.dto';

@Injectable()
export class OverheadRulesService {
  constructor(private readonly prisma: PrismaService) {}

  private validateScope(dto: {
    scope: OverheadScope;
    brandId?: string;
    countryId?: string;
    itemId?: string;
    categoryId?: string;
  }) {
    if (dto.scope === OverheadScope.BRAND && !dto.brandId) {
      throw new BadRequestException('brandId is required for BRAND scope');
    }
    if (dto.scope === OverheadScope.COUNTRY && !dto.countryId) {
      throw new BadRequestException('countryId is required for COUNTRY scope');
    }
    if (dto.scope === OverheadScope.ITEM && !dto.itemId) {
      throw new BadRequestException('itemId is required for ITEM scope');
    }
    if (dto.scope === OverheadScope.CATEGORY && !dto.categoryId) {
      throw new BadRequestException(
        'categoryId is required for CATEGORY scope',
      );
    }
  }

  private validateCurrency(
    method: OverheadAllocationMethod,
    currency?: string,
  ) {
    if (
      (method === OverheadAllocationMethod.PER_UNIT ||
        method === OverheadAllocationMethod.PER_ORDER) &&
      !currency
    ) {
      throw new BadRequestException(
        'currency is required for PER_UNIT or PER_ORDER method',
      );
    }
  }

  async create(dto: CreateOverheadRuleDto) {
    this.validateScope(dto);
    this.validateCurrency(dto.method, dto.currency);

    const rule = await this.prisma.overheadAllocationRule.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        method: dto.method,
        rate: new Prisma.Decimal(dto.rate),
        currency: dto.currency ?? null,
        scope: dto.scope,
        brandId: dto.brandId ?? null,
        countryId: dto.countryId ?? null,
        itemId: dto.itemId ?? null,
        categoryId: dto.categoryId ?? null,
      },
    });

    return rule;
  }

  async list(filters: FilterOverheadRulesDto) {
    const where: any = {};
    if (filters.scope) where.scope = filters.scope;
    if (filters.method) where.method = filters.method;
    if (filters.isActive !== undefined)
      where.isActive = filters.isActive === 'true';
    if (filters.brandId) where.brandId = filters.brandId;
    if (filters.countryId) where.countryId = filters.countryId;
    if (filters.itemId) where.itemId = filters.itemId;
    if (filters.categoryId) where.categoryId = filters.categoryId;

    return this.prisma.overheadAllocationRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(id: string) {
    const rule = await this.prisma.overheadAllocationRule.findUnique({
      where: { id },
    });
    if (!rule) {
      throw new NotFoundException('Overhead rule not found');
    }
    return rule;
  }

  async update(id: string, dto: UpdateOverheadRuleDto) {
    const existing = await this.prisma.overheadAllocationRule.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Overhead rule not found');
    }

    if (
      dto.scope ||
      dto.brandId !== undefined ||
      dto.countryId !== undefined ||
      dto.itemId !== undefined ||
      dto.categoryId !== undefined
    ) {
      this.validateScope({
        scope: (dto.scope as OverheadScope) || existing.scope,
        brandId: dto.brandId ?? existing.brandId ?? undefined,
        countryId: dto.countryId ?? existing.countryId ?? undefined,
        itemId: dto.itemId ?? existing.itemId ?? undefined,
        categoryId: dto.categoryId ?? existing.categoryId ?? undefined,
      });
    }
    if (dto.method || dto.currency !== undefined) {
      this.validateCurrency(
        (dto.method as OverheadAllocationMethod) || existing.method,
        dto.currency ?? existing.currency ?? undefined,
      );
    }

    const updateData: Prisma.OverheadAllocationRuleUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.method !== undefined) updateData.method = dto.method;
    if (dto.rate !== undefined) updateData.rate = new Prisma.Decimal(dto.rate);
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.scope !== undefined) updateData.scope = dto.scope;
    if (dto.brandId !== undefined) updateData.brandId = dto.brandId;
    if (dto.countryId !== undefined) updateData.countryId = dto.countryId;
    if (dto.itemId !== undefined) (updateData as any).itemId = dto.itemId;
    if (dto.categoryId !== undefined) updateData.categoryId = dto.categoryId;
    if (dto.hasOwnProperty('isActive'))
      updateData.isActive = (dto as any).isActive;

    return this.prisma.overheadAllocationRule.update({
      where: { id },
      data: updateData,
    });
  }

  async deactivate(id: string) {
    await this.getOne(id);
    return this.prisma.overheadAllocationRule.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Calculate overhead for a production order context (v1: currency must match).
   * Currency conversion is out of scope here (TODO: integrate currency rates when available).
   */
  async calculateForProductionOrder(params: {
    currency: string;
    producedQty: Prisma.Decimal;
    totalMaterialCost: Prisma.Decimal;
    productId?: string | null;
    productBrandId?: string | null;
    productionCountryId?: string | null;
    productCategoryId?: string | null;
  }) {
    const rules = await this.prisma.overheadAllocationRule.findMany({
      where: { isActive: true },
    });

    const matchesScope = (rule: any) => {
      switch (rule.scope) {
        case OverheadScope.GLOBAL:
          return true;
        case OverheadScope.BRAND:
          return (
            rule.brandId &&
            params.productBrandId &&
            rule.brandId === params.productBrandId
          );
        case OverheadScope.COUNTRY:
          return (
            rule.countryId &&
            params.productionCountryId &&
            rule.countryId === params.productionCountryId
          );
        case OverheadScope.ITEM:
          return (
            rule.itemId && params.productId && rule.itemId === params.productId
          );
        case OverheadScope.CATEGORY:
          return (
            rule.categoryId &&
            params.productCategoryId &&
            rule.categoryId === params.productCategoryId
          );
        default:
          return false;
      }
    };

    type OverheadLine = {
      ruleId: string;
      name: string;
      method: OverheadAllocationMethod;
      scope: OverheadScope;
      rate: Prisma.Decimal;
      currency: string;
      base: Prisma.Decimal;
      amount: Prisma.Decimal;
    };

    const lines: OverheadLine[] = [];
    for (const rule of rules) {
      if (!matchesScope(rule)) continue;

      // v1: skip rules with incompatible currency for rate-based methods
      if (
        (rule.method === OverheadAllocationMethod.PER_UNIT ||
          rule.method === OverheadAllocationMethod.PER_ORDER) &&
        rule.currency &&
        rule.currency !== params.currency
      ) {
        // TODO: integrate currency conversion (block 10)
        continue;
      }

      const rate = new Prisma.Decimal(rule.rate);
      let base = new Prisma.Decimal(0);
      let amount = new Prisma.Decimal(0);
      switch (rule.method) {
        case OverheadAllocationMethod.PER_UNIT:
          base = params.producedQty;
          amount = rate.mul(params.producedQty);
          break;
        case OverheadAllocationMethod.PER_ORDER:
          base = new Prisma.Decimal(1);
          amount = rate;
          break;
        case OverheadAllocationMethod.PERCENT_OF_MATERIAL_COST:
          base = params.totalMaterialCost;
          amount = params.totalMaterialCost.mul(rate).div(100);
          break;
        default:
          continue;
      }

      lines.push({
        ruleId: rule.id,
        name: rule.name,
        method: rule.method,
        scope: rule.scope,
        rate: rule.rate,
        currency: rule.currency ?? params.currency,
        base,
        amount,
      });
    }

    const totalOverhead = lines.reduce(
      (sum, l) => sum.add(l.amount),
      new Prisma.Decimal(0),
    );

    return {
      totalOverhead,
      lines,
    };
  }
}
