import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: { code: string; name: string }) {
    const code = dto.code.trim();
    const existing = await this.prisma.brand.findUnique({ where: { code } });
    if (existing) return existing;
    return this.prisma.brand.create({
      data: { code, name: dto.name.trim() } as any,
    });
  }

  async linkBrandCountry(dto: {
    brandId: string;
    countryId: string;
    legalEntityId?: string;
  }) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: dto.brandId },
      select: { id: true },
    });
    if (!brand) throw new NotFoundException('Brand not found');

    const country = await this.prisma.country.findUnique({
      where: { id: dto.countryId },
      select: { id: true },
    });
    if (!country) throw new NotFoundException('Country not found');

    if (dto.legalEntityId) {
      const le = await this.prisma.legalEntity.findUnique({
        where: { id: dto.legalEntityId },
        select: { id: true },
      });
      if (!le) throw new NotFoundException('LegalEntity not found');
    }

    const existing = await (this.prisma as any).brandCountry.findUnique({
      where: {
        brandId_countryId: { brandId: dto.brandId, countryId: dto.countryId },
      } as any,
    });
    if (existing) {
      if (dto.legalEntityId && existing.legalEntityId !== dto.legalEntityId) {
        return (this.prisma as any).brandCountry.update({
          where: {
            brandId_countryId: {
              brandId: dto.brandId,
              countryId: dto.countryId,
            },
          } as any,
          data: { legalEntityId: dto.legalEntityId } as any,
        });
      }
      return existing;
    }

    return (this.prisma as any).brandCountry.create({
      data: {
        brandId: dto.brandId,
        countryId: dto.countryId,
        legalEntityId: dto.legalEntityId ?? null,
      } as any,
    });
  }
}




