import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatementLineStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { ClassifyStatementLineDto } from './dto/classify-statement-line.dto';

@Injectable()
export class StatementsService {
  constructor(private readonly prisma: PrismaService) {}

  async listStatements(filter?: {
    legalEntityId?: string;
    accountId?: string;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.StatementWhereInput = {};
    if (filter?.legalEntityId)
      (where as any).legalEntityId = filter.legalEntityId;
    if (filter?.accountId) (where as any).accountId = filter.accountId;
    if (filter?.from || filter?.to) {
      (where as any).importedAt = {};
      if (filter.from) (where as any).importedAt.gte = filter.from;
      if (filter.to) (where as any).importedAt.lte = filter.to;
    }
    return this.prisma.statement.findMany({
      where,
      orderBy: [{ importedAt: 'desc' }],
      include: { account: true },
    });
  }

  async getStatement(id: string) {
    const st = await this.prisma.statement.findUnique({
      where: { id },
      include: { account: true, lines: { orderBy: { lineIndex: 'asc' } } },
    });
    if (!st) throw new NotFoundException('Statement not found');
    return st;
  }

  async listStatementLines(filter?: {
    legalEntityId?: string;
    accountId?: string;
    status?: StatementLineStatus;
    from?: Date;
    to?: Date;
    q?: string;
    parentLineId?: string;
  }) {
    const where: Prisma.StatementLineWhereInput = {};
    if (filter?.legalEntityId)
      (where as any).legalEntityId = filter.legalEntityId;
    if (filter?.accountId) (where as any).accountId = filter.accountId;
    if (filter?.status) (where as any).status = filter.status;
    if (filter?.parentLineId) (where as any).parentLineId = filter.parentLineId;
    if (filter?.from || filter?.to) {
      (where as any).occurredAt = {};
      if (filter.from) (where as any).occurredAt.gte = filter.from;
      if (filter.to) (where as any).occurredAt.lte = filter.to;
    }
    const q = (filter?.q ?? '').trim();
    if (q) {
      (where as any).OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { bankReference: { contains: q, mode: 'insensitive' } },
        { counterpartyName: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.statementLine.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      include: { statement: true },
      take: 500,
    });
  }

  async getStatementLine(id: string) {
    const line = await this.prisma.statementLine.findUnique({
      where: { id },
      include: { statement: true },
    });
    if (!line) throw new NotFoundException('StatementLine not found');
    return line;
  }

  async classifyStatementLine(id: string, dto: ClassifyStatementLineDto) {
    const line = await this.prisma.statementLine.findUnique({ where: { id } });
    if (!line) throw new NotFoundException('StatementLine not found');

    if (
      (line as any).isSplitParent ||
      (line as any).status === (StatementLineStatus as any).SPLIT
    ) {
      throw new ConflictException(
        'Line is SPLIT parent; classify children instead',
      );
    }

    return this.prisma.statementLine.update({
      where: { id },
      data: {
        operationTypeHint: dto.operationTypeHint ?? null,
        externalOperationCode: dto.externalOperationCode ?? null,
        marketplaceOrderId: dto.marketplaceOrderId ?? null,
        saleDocumentId: dto.saleDocumentId ?? null,
        cashflowCategoryId: dto.cashflowCategoryId ?? null,
        feeKey: dto.feeKey ?? null,
      } as any,
    });
  }
}
