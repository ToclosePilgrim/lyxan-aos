import { Injectable } from '@nestjs/common';
import {
  Prisma,
  AccountingDocType,
  FinanceLinkedDocType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LedgerAggregateService {
  constructor(private readonly prisma: PrismaService) {}

  async getSupplyLedger(supplyId: string) {
    const financialDocs = await this.prisma.financialDocument.findMany({
      where: {
        linkedDocType: FinanceLinkedDocType.SUPPLY,
        linkedDocId: supplyId,
      },
      select: { id: true },
    });
    const financialDocIds = financialDocs.map((d) => d.id);

    const orFilters: Prisma.AccountingEntryWhereInput[] = [
      {
        docType: AccountingDocType.SUPPLY,
        docId: supplyId,
      },
    ];

    if (financialDocIds.length > 0) {
      orFilters.push({
        docType: AccountingDocType.FINANCIAL_DOCUMENT,
        docId: { in: financialDocIds },
      });
      for (const id of financialDocIds) {
        orFilters.push({
          docType: AccountingDocType.PAYMENT,
          metadata: {
            path: ['financialDocumentId'],
            equals: id,
          },
        });
      }
    }

    return this.prisma.accountingEntry.findMany({
      where: {
        OR: orFilters,
      },
      orderBy: [{ postingDate: 'asc' }, { lineNumber: 'asc' }],
    });
  }

  async getFinancialDocumentLedger(financialDocumentId: string) {
    return this.prisma.accountingEntry.findMany({
      where: {
        OR: [
          {
            docType: AccountingDocType.FINANCIAL_DOCUMENT,
            docId: financialDocumentId,
          },
          {
            docType: AccountingDocType.PAYMENT,
            metadata: {
              path: ['financialDocumentId'],
              equals: financialDocumentId,
            } as any,
          },
        ],
      },
      orderBy: [{ postingDate: 'asc' }, { lineNumber: 'asc' }],
    });
  }
}
