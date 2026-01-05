import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinanceCategoryMappingSourceType, Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class CategoryDefaultMappingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter?: {
    legalEntityId?: string;
    sourceType?: FinanceCategoryMappingSourceType;
    sourceCode?: string;
    includeInactive?: boolean;
  }) {
    const where: Prisma.FinanceCategoryDefaultMappingWhereInput = {};
    if (filter?.legalEntityId !== undefined) {
      (where as any).legalEntityId = filter.legalEntityId || null;
    }
    if (filter?.sourceType) (where as any).sourceType = filter.sourceType;
    if (filter?.sourceCode)
      (where as any).sourceCode = filter.sourceCode.trim().toUpperCase();
    if (!filter?.includeInactive) (where as any).isActive = true;

    return this.prisma.financeCategoryDefaultMapping.findMany({
      where,
      orderBy: [
        { legalEntityId: 'asc' },
        { sourceType: 'asc' },
        { priority: 'asc' },
        { sourceCode: 'asc' },
      ],
      take: 1000,
    });
  }

  async create(input: {
    legalEntityId?: string;
    sourceType: FinanceCategoryMappingSourceType;
    sourceCode: string;
    defaultCashflowCategoryId?: string;
    defaultPnlCategoryId?: string;
    priority?: number;
    isActive?: boolean;
  }) {
    const sourceCode = (input.sourceCode ?? '').trim().toUpperCase();
    if (!sourceCode) throw new BadRequestException('sourceCode is required');
    const legalEntityId = input.legalEntityId ? input.legalEntityId : null;

    try {
      return await this.prisma.financeCategoryDefaultMapping.create({
        data: {
          id: crypto.randomUUID(),
          legalEntityId,
          sourceType: input.sourceType,
          sourceCode,
          defaultCashflowCategoryId: input.defaultCashflowCategoryId ?? null,
          defaultPnlCategoryId: input.defaultPnlCategoryId ?? null,
          priority: input.priority ?? 100,
          isActive: input.isActive ?? true,
        } as any,
      });
    } catch (e: any) {
      if (e?.code === 'P2002')
        throw new ConflictException(
          'Default mapping already exists for this key',
        );
      throw e;
    }
  }

  async update(id: string, patch: any) {
    const existing = await this.prisma.financeCategoryDefaultMapping.findUnique(
      { where: { id } },
    );
    if (!existing) throw new NotFoundException('Mapping not found');

    const data: any = {};
    if (patch.legalEntityId !== undefined)
      data.legalEntityId = patch.legalEntityId || null;
    if (patch.sourceType !== undefined) data.sourceType = patch.sourceType;
    if (patch.sourceCode !== undefined)
      data.sourceCode = String(patch.sourceCode).trim().toUpperCase();
    if (patch.defaultCashflowCategoryId !== undefined)
      data.defaultCashflowCategoryId = patch.defaultCashflowCategoryId || null;
    if (patch.defaultPnlCategoryId !== undefined)
      data.defaultPnlCategoryId = patch.defaultPnlCategoryId || null;
    if (patch.priority !== undefined) data.priority = patch.priority;
    if (patch.isActive !== undefined) data.isActive = patch.isActive;

    try {
      return await this.prisma.financeCategoryDefaultMapping.update({
        where: { id },
        data,
      });
    } catch (e: any) {
      if (e?.code === 'P2002')
        throw new ConflictException(
          'Default mapping already exists for this key',
        );
      throw e;
    }
  }

  async archive(id: string) {
    const existing = await this.prisma.financeCategoryDefaultMapping.findUnique(
      { where: { id } },
    );
    if (!existing) throw new NotFoundException('Mapping not found');
    if (!existing.isActive) return existing;
    return this.prisma.financeCategoryDefaultMapping.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

