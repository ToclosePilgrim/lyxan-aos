import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountingDocType, Prisma, SalesDocumentStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryService } from '../accounting-entry/accounting-entry.service';
import { ACCOUNTING_ACCOUNTS } from '../accounting-accounts.config';
import {
  buildMarketplaceFeeKey,
  normalizeMarketplaceFeeCode,
  normalizeMarketplaceProvider,
} from '../marketplace-fee-key';
import { ListSalesDocumentsDto } from './dto/list-sales-documents.dto';
import { PostingRunsService } from '../posting-runs/posting-runs.service';
import crypto from 'node:crypto';

@Injectable()
export class SalesDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingEntryService,
    private readonly postingRuns: PostingRunsService,
  ) {}

  private async resolveLegalEntityIdForSalesDoc(doc: any): Promise<string> {
    const le = doc.legalEntityId ?? null;
    if (le) return le;
    const brandId = doc.brandId ?? null;
    const countryId = doc.countryId ?? null;
    if (!brandId || !countryId) {
      throw new NotFoundException(
        'Cannot resolve legalEntityId for SalesDocument',
      );
    }
    const bc = await (this.prisma as any).brandCountry.findUnique({
      where: { brandId_countryId: { brandId, countryId } },
      select: { legalEntityId: true },
    });
    if (!bc?.legalEntityId) {
      throw new NotFoundException(
        'No LegalEntity configured for sales doc brand+country',
      );
    }
    return bc.legalEntityId as string;
  }

  async list(_query: ListSalesDocumentsDto) {
    // Minimal implementation for compilation/testing.
    // Full posting pipeline lives in finance/sales-documents; not required for supply receive tests.
    return [];
  }

  async create(dto: {
    brandId?: string | null;
    countryId?: string | null;
    marketplaceId?: string | null;
    warehouseId?: string | null;
    sourceType: string;
    externalId?: string | null;
    periodFrom: Date;
    periodTo: Date;
    status?: SalesDocumentStatus;
    lines: Array<{
      itemId: string;
      warehouseId?: string | null;
      date: Date;
      quantity: Prisma.Decimal | string | number;
      revenue: Prisma.Decimal | string | number;
      commission: Prisma.Decimal | string | number;
      refunds?: Prisma.Decimal | string | number | null;
      cogsAmount?: Prisma.Decimal | string | number | null;
      meta?: any;
    }>;
  }) {
    if (!dto.lines || dto.lines.length === 0) {
      throw new NotFoundException('SalesDocument.lines is required');
    }
    const totals = dto.lines.reduce(
      (acc, l) => {
        acc.totalRevenue = acc.totalRevenue.add(
          new Prisma.Decimal(l.revenue as any),
        );
        acc.totalCommission = acc.totalCommission.add(
          new Prisma.Decimal(l.commission as any),
        );
        acc.totalRefunds = acc.totalRefunds.add(
          new Prisma.Decimal((l.refunds as any) ?? 0),
        );
        acc.totalQty = acc.totalQty.add(new Prisma.Decimal(l.quantity as any));
        acc.totalCogs = acc.totalCogs.add(
          new Prisma.Decimal((l.cogsAmount as any) ?? 0),
        );
        return acc;
      },
      {
        totalRevenue: new Prisma.Decimal(0),
        totalCommission: new Prisma.Decimal(0),
        totalRefunds: new Prisma.Decimal(0),
        totalQty: new Prisma.Decimal(0),
        totalCogs: new Prisma.Decimal(0),
      },
    );

    return this.prisma.salesDocument.create({
      data: {
        id: crypto.randomUUID(),
        brandId: dto.brandId ?? null,
        countryId: dto.countryId ?? null,
        marketplaceId: dto.marketplaceId ?? null,
        warehouseId: dto.warehouseId ?? null,
        sourceType: dto.sourceType,
        externalId: dto.externalId ?? null,
        periodFrom: dto.periodFrom,
        periodTo: dto.periodTo,
        status: dto.status ?? SalesDocumentStatus.IMPORTED,
        totalRevenue: totals.totalRevenue,
        totalCommission: totals.totalCommission,
        totalRefunds: totals.totalRefunds,
        totalQty: totals.totalQty,
        totalCogs: totals.totalCogs,
        SalesDocumentLine: {
          create: dto.lines.map((l) => ({
            id: crypto.randomUUID(),
            itemId: l.itemId,
            warehouseId: l.warehouseId ?? null,
            date: l.date,
            quantity: new Prisma.Decimal(l.quantity as any),
            revenue: new Prisma.Decimal(l.revenue as any),
            commission: new Prisma.Decimal(l.commission as any),
            refunds: new Prisma.Decimal((l.refunds as any) ?? 0),
            cogsAmount: new Prisma.Decimal((l.cogsAmount as any) ?? 0),
            meta: l.meta ? l.meta : undefined,
          })),
        },
      } as any,
      include: { SalesDocumentLine: true },
    });
  }

  async getById(id: string) {
    // Try to load if table exists; otherwise return stub.
    const doc = await (this.prisma as any).salesDocument?.findUnique?.({
      where: { id },
      include: { lines: true },
    });
    return doc ?? { id, lines: [] };
  }

  private async postWithRun(
    tx: Prisma.TransactionClient,
    doc: any,
    runId: string,
  ) {
    const provider = normalizeMarketplaceProvider(
      doc.Marketplace?.code ?? null,
    );
    const currency = 'RUB'; // SalesDocument has no currency; assume settlement currency for RU (MVP).

    let createdOrReused = 0;
    for (let i = 0; i < doc.SalesDocumentLine.length; i++) {
      const line = doc.SalesDocumentLine[i];
      const commission = new Prisma.Decimal(line.commission);
      if (!commission || commission.lte(0)) continue;

      const meta = line.meta ?? {};
      const mp = meta.marketplace ?? meta.mp ?? {};

      const feeCode =
        normalizeMarketplaceFeeCode(
          mp.feeCode ?? mp.feeType ?? meta.feeCode ?? null,
        ) ?? 'COMMISSION';
      const orderId = (mp.orderId ??
        meta.orderId ??
        meta.marketplaceOrderId ??
        null) as string | null;
      const operationId = (mp.operationId ??
        meta.operationId ??
        meta.marketplaceOperationId ??
        null) as string | null;

      const baseDocLineId = `sales_document_line:${line.id}:fee:${feeCode}`;
      const docLineId = `${baseDocLineId}:run:${runId}`;
      const feeKey = buildMarketplaceFeeKey({
        provider,
        feeCode,
        orderId,
        operationId,
        docLineId: baseDocLineId, // stable key independent of run
      });

      const lineNumber =
        1 +
        (await tx.accountingEntry.count({
          where: {
            docType: AccountingDocType.SALES_DOCUMENT,
            docId: doc.id,
          } as any,
        }));

      const entry = await this.accounting.createEntry({
        tx,
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: doc.id,
        brandId: doc.brandId ?? undefined,
        countryId: doc.countryId ?? undefined,
        marketplaceId: doc.marketplaceId ?? null,
        warehouseId: line.warehouseId ?? doc.warehouseId ?? null,
        lineNumber,
        postingDate: new Date(line.date),
        debitAccount: ACCOUNTING_ACCOUNTS.MARKETPLACE_FEES,
        creditAccount: ACCOUNTING_ACCOUNTS.ACCOUNTS_RECEIVABLE_MARKETPLACE,
        amount: commission,
        currency,
        description: `Marketplace fee ${feeCode}${orderId ? ` (order ${orderId})` : ''}`,
        metadata: {
          docLineId,
          salesDocumentId: doc.id,
          salesDocumentLineId: line.id,
          marketplace: {
            provider,
            orderId: orderId ?? null,
            feeCode,
            operationId: operationId ?? null,
            feeKey,
          },
        },
        postingRunId: runId,
      } as any);

      if (entry) createdOrReused += 1;
    }

    await tx.salesDocument.update({
      where: { id: doc.id },
      data: { status: SalesDocumentStatus.POSTED } as any,
    });

    return {
      id: doc.id,
      posted: true,
      feeEntries: createdOrReused,
      postingRunId: runId,
    };
  }

  async postSalesDocument(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const doc = await tx.salesDocument.findUnique({
        where: { id },
        include: {
          SalesDocumentLine: true,
          Marketplace: true,
        } as any,
      });
      if (!doc) throw new NotFoundException('SalesDocument not found');

      const legalEntityId = await this.resolveLegalEntityIdForSalesDoc(
        doc as any,
      );
      const run = await this.postingRuns.getOrCreatePostedRun({
        tx,
        legalEntityId,
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: doc.id,
      } as any);
      const has = await this.postingRuns.hasEntries({ tx, runId: run.id });
      if (has) {
        return {
          id: doc.id,
          posted: true,
          feeEntries: 0,
          alreadyPosted: true,
          postingRunId: run.id,
        };
      }
      return this.postWithRun(tx, doc as any, run.id);
    });
  }

  async voidSalesDocument(params: { id: string; reason: string }) {
    const doc = await (this.prisma as any).salesDocument.findUnique({
      where: { id: params.id },
    });
    if (!doc) throw new NotFoundException('SalesDocument not found');
    const legalEntityId = await this.resolveLegalEntityIdForSalesDoc(doc);
    const active = await this.postingRuns.getActivePostedRun({
      legalEntityId,
      docType: AccountingDocType.SALES_DOCUMENT,
      docId: doc.id,
    } as any);
    if (!active) return { voided: false, reason: 'no active run' };
    await this.prisma.$transaction(async (tx) => {
      await this.postingRuns.voidRun({
        tx,
        runId: active.id,
        reason: params.reason,
      });
      await tx.salesDocument.update({
        where: { id: doc.id },
        data: { status: SalesDocumentStatus.DRAFT } as any,
      });
    });
    return { voided: true, salesDocumentId: doc.id };
  }

  async repostSalesDocument(params: { id: string; reason: string }) {
    const doc = await (this.prisma as any).salesDocument.findUnique({
      where: { id: params.id },
      include: { SalesDocumentLine: true, Marketplace: true } as any,
    });
    if (!doc) throw new NotFoundException('SalesDocument not found');

    return this.prisma.$transaction(async (tx) => {
      const legalEntityId = await this.resolveLegalEntityIdForSalesDoc(doc);
      const active = await this.postingRuns.getActivePostedRun({
        tx,
        legalEntityId,
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: doc.id,
      } as any);
      if (active) {
        await this.postingRuns.voidRun({
          tx,
          runId: active.id,
          reason: params.reason,
        });
      }
      const next = await this.postingRuns.createNextRun({
        tx,
        legalEntityId,
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: doc.id,
        repostedFromRunId: active?.id ?? null,
      } as any);

      return this.postWithRun(tx, doc, next.id);
    });
  }
}
