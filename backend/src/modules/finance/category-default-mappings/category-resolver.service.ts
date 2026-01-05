import { Injectable } from '@nestjs/common';
import { FinanceCategoryMappingSourceType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export type CategoryResolvedBy =
  | 'EXPLICIT'
  | 'DEFAULT_LEGAL_ENTITY'
  | 'DEFAULT_GLOBAL'
  | 'NONE';

@Injectable()
export class FinanceCategoryResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveDefaults(input: {
    legalEntityId: string;
    sourceType: FinanceCategoryMappingSourceType;
    sourceCode: string;
  }): Promise<{
    cashflowCategoryId: string | null;
    pnlCategoryId: string | null;
    resolvedBy: CategoryResolvedBy;
    mappingId: string | null;
  }> {
    const sourceCode = (input.sourceCode ?? '').trim().toUpperCase();
    if (!sourceCode) {
      return {
        cashflowCategoryId: null,
        pnlCategoryId: null,
        resolvedBy: 'NONE',
        mappingId: null,
      };
    }

    const le = await this.prisma.financeCategoryDefaultMapping.findFirst({
      where: {
        legalEntityId: input.legalEntityId,
        sourceType: input.sourceType,
        sourceCode,
        isActive: true,
      } as any,
      orderBy: [{ priority: 'asc' }],
    });
    if (le) {
      return {
        cashflowCategoryId: (le as any).defaultCashflowCategoryId ?? null,
        pnlCategoryId: (le as any).defaultPnlCategoryId ?? null,
        resolvedBy: 'DEFAULT_LEGAL_ENTITY',
        mappingId: le.id,
      };
    }

    const global = await this.prisma.financeCategoryDefaultMapping.findFirst({
      where: {
        legalEntityId: null,
        sourceType: input.sourceType,
        sourceCode,
        isActive: true,
      } as Prisma.FinanceCategoryDefaultMappingWhereInput,
      orderBy: [{ priority: 'asc' }],
    });
    if (global) {
      return {
        cashflowCategoryId: (global as any).defaultCashflowCategoryId ?? null,
        pnlCategoryId: (global as any).defaultPnlCategoryId ?? null,
        resolvedBy: 'DEFAULT_GLOBAL',
        mappingId: global.id,
      };
    }

    return {
      cashflowCategoryId: null,
      pnlCategoryId: null,
      resolvedBy: 'NONE',
      mappingId: null,
    };
  }
}

