import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class FinanceCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCashflowCategory(dto: {
    code: string;
    name: string;
    isTransfer?: boolean;
  }) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.cashflowCategory.findUnique({
      where: { code },
    });
    if (existing) {
      if (dto.isTransfer === true && !(existing as any).isTransfer) {
        return this.prisma.cashflowCategory.update({
          where: { id: existing.id } as any,
          data: { isTransfer: true } as any,
        });
      }
      return existing;
    }
    return this.prisma.cashflowCategory.create({
      data: {
        code,
        name: dto.name.trim(),
        isActive: true,
        isTransfer: dto.isTransfer ?? false,
      } as any,
    });
  }

  async ensurePnlCategory(dto: { code: string; name: string }) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.pnlCategory.findUnique({
      where: { code },
    });
    if (existing) return existing;
    return this.prisma.pnlCategory.create({
      data: { code, name: dto.name.trim(), isActive: true } as any,
    });
  }
}
