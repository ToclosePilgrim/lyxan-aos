import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class LegalEntitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: { code: string; name: string; countryCode: string }) {
    const code = dto.code.trim();
    const existing = await this.prisma.legalEntity.findUnique({
      where: { code },
    });
    if (existing) return existing;

    const country = await this.prisma.country.findUnique({
      where: { code: dto.countryCode.trim().toUpperCase() },
      select: { code: true },
    });
    if (!country) throw new NotFoundException('Country not found');

    return this.prisma.legalEntity.create({
      data: {
        code,
        name: dto.name.trim(),
        countryCode: country.code,
      } as any,
    });
  }
}




