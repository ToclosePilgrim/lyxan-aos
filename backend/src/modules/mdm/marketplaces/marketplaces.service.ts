import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class MarketplacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: { code: string; name: string }) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.marketplace.findUnique({
      where: { code },
    });
    if (existing) return existing;
    return this.prisma.marketplace.create({
      data: { code, name: dto.name.trim() } as any,
    });
  }
}

