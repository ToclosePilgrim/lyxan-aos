import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: { code: string; name: string }) {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    const existing = await this.prisma.country.findUnique({ where: { code } });
    if (existing) return existing;
    return this.prisma.country.create({
      data: {
        code,
        name,
      } as any,
    });
  }

  async findOneByCode(code: string) {
    const c = await this.prisma.country.findUnique({
      where: { code: code.trim().toUpperCase() },
    });
    if (!c) throw new NotFoundException('Country not found');
    return c;
  }
}

