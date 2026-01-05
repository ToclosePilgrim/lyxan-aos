import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatementLineStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class StatementLinesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter?: {
    legalEntityId?: string;
    accountId?: string;
    status?: StatementLineStatus;
    from?: Date;
    to?: Date;
    q?: string;
  }) {
    const where: Prisma.StatementLineWhereInput = {};
    if (filter?.legalEntityId)
      (where as any).legalEntityId = filter.legalEntityId;
    if (filter?.accountId) (where as any).accountId = filter.accountId;
    if (filter?.status) (where as any).status = filter.status;
    if (filter?.from || filter?.to) {
      (where as any).occurredAt = {};
      if (filter.from) (where as any).occurredAt.gte = filter.from;
      if (filter.to) (where as any).occurredAt.lte = filter.to;
    }
    const q = filter?.q?.trim();
    if (q) {
      (where as any).OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { bankReference: { contains: q, mode: 'insensitive' } },
        { counterpartyName: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.statementLine.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { lineIndex: 'asc' }],
      take: 500,
    });
  }

  async getById(id: string) {
    const line = await this.prisma.statementLine.findUnique({ where: { id } });
    if (!line) throw new NotFoundException('StatementLine not found');
    return line;
  }
}
