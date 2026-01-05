import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, FinancialAccountStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CreateFinancialAccountDto } from './dto/create-financial-account.dto';
import { UpdateFinancialAccountDto } from './dto/update-financial-account.dto';

@Injectable()
export class FinancialAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCurrency(currency: string) {
    const cur = (currency ?? '').toUpperCase().trim();
    if (!cur || cur.length !== 3) {
      throw new BadRequestException('currency must be a 3-letter ISO code');
    }
    return cur;
  }

  private async ensureLegalEntityExists(legalEntityId: string) {
    const le = await (this.prisma as any).legalEntity.findUnique({
      where: { id: legalEntityId },
      select: { id: true },
    });
    if (!le) {
      throw new NotFoundException('LegalEntity not found');
    }
  }

  private async ensureNoDuplicateExternal(params: {
    legalEntityId: string;
    type: any;
    provider?: string | null;
    externalRef?: string | null;
    excludeId?: string;
  }) {
    const ext = (params.externalRef ?? '').trim();
    if (!ext) return; // only enforce duplicates for externalRef-present accounts

    const existing = await this.prisma.financialAccount.findFirst({
      where: {
        id: params.excludeId ? { not: params.excludeId } : undefined,
        legalEntityId: params.legalEntityId,
        type: params.type,
        provider: params.provider ?? null,
        externalRef: ext,
      } as any,
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'FinancialAccount with the same externalRef already exists for this legalEntity',
      );
    }
  }

  async create(dto: CreateFinancialAccountDto) {
    await this.ensureLegalEntityExists(dto.legalEntityId);
    const currency = this.normalizeCurrency(dto.currency);

    const provider = dto.provider?.trim() || null;
    const externalRef = dto.externalRef?.trim() || null;
    await this.ensureNoDuplicateExternal({
      legalEntityId: dto.legalEntityId,
      type: dto.type,
      provider,
      externalRef,
    });

    return this.prisma.financialAccount.create({
      data: {
        legalEntityId: dto.legalEntityId,
        type: dto.type,
        currency,
        name: dto.name,
        provider,
        externalRef,
        status: dto.status ?? FinancialAccountStatus.ACTIVE,
      },
    });
  }

  async list(params: { legalEntityId: string; includeArchived?: boolean }) {
    if (!params.legalEntityId) {
      throw new BadRequestException('legalEntityId is required');
    }
    await this.ensureLegalEntityExists(params.legalEntityId);

    const where: Prisma.FinancialAccountWhereInput = {
      legalEntityId: params.legalEntityId,
    };
    if (!params.includeArchived) {
      (where as any).status = FinancialAccountStatus.ACTIVE;
    }

    return this.prisma.financialAccount.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async getById(id: string) {
    const acc = await this.prisma.financialAccount.findUnique({
      where: { id },
    });
    if (!acc) throw new NotFoundException('FinancialAccount not found');
    return acc;
  }

  async update(id: string, dto: UpdateFinancialAccountDto) {
    const existing = await this.prisma.financialAccount.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('FinancialAccount not found');

    // Only allow updating a subset (per spec)
    const provider =
      dto.provider !== undefined
        ? dto.provider?.trim() || null
        : existing.provider;
    const externalRef =
      dto.externalRef !== undefined
        ? dto.externalRef?.trim() || null
        : existing.externalRef;

    await this.ensureNoDuplicateExternal({
      legalEntityId: existing.legalEntityId,
      type: existing.type,
      provider,
      externalRef,
      excludeId: id,
    });

    return this.prisma.financialAccount.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        provider: dto.provider !== undefined ? provider : undefined,
        externalRef: dto.externalRef !== undefined ? externalRef : undefined,
        status: (dto as any).status ?? undefined,
      } as any,
    });
  }
}
