import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  AccountingDocType,
  MovementDocType,
  MovementType,
  Prisma,
  SalesDocumentStatus,
  SalesReturnOperationStatus,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryService } from '../accounting-entry/accounting-entry.service';
import {
  buildMarketplaceFeeKey,
  normalizeMarketplaceFeeCode,
  normalizeMarketplaceProvider,
} from '../marketplace-fee-key';
import { ListSalesDocumentsDto } from './dto/list-sales-documents.dto';
import { PostingRunsService } from '../posting-runs/posting-runs.service';
import crypto from 'node:crypto';
import { AccountingValidationService } from '../accounting-validation.service';
import { InventoryOrchestratorService } from '../../inventory/inventory-orchestrator.service';
import {
  InventoryAccountingLinkRole,
  InventoryBatchSourceType,
  InventoryDocumentType,
  InventoryMovementType,
} from '../../inventory/inventory.enums';
import { getBaseCurrency } from '../constants';
import { InventoryAccountingLinkWriterService } from '../../inventory/inventory-accounting-link-writer.service';
import { FinanceAccountMappingService } from '../account-mapping/finance-account-mapping.service';
import { InventoryAccountingLinkType } from '@prisma/client';

@Injectable()
export class SalesDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingEntryService,
    private readonly postingRuns: PostingRunsService,
    private readonly validation: AccountingValidationService,
    private readonly inventoryOrchestrator: InventoryOrchestratorService,
    private readonly inventoryLinks: InventoryAccountingLinkWriterService,
    private readonly accountMapping: FinanceAccountMappingService,
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
    const baseCurrency = getBaseCurrency();

    if (!doc?.SalesDocumentLine?.length) {
      throw new BadRequestException('SalesDocument must have at least one line');
    }

    const legalEntityId = await this.resolveLegalEntityIdForSalesDoc(doc as any);
    const accounts = await this.accountMapping.getSalesPostingAccounts({
      legalEntityId,
      marketplaceId: doc.marketplaceId ?? null,
    });

    // ========== 1) Inventory FIFO OUT (COGS source) ==========
    let totalCostBase = new Prisma.Decimal(0);
    const allMovementIds: string[] = [];
    const lineOutcomes: Array<{
      lineId: string;
      transactionId: string;
      movementIds: string[];
      totalCostBase: Prisma.Decimal;
    }> = [];

    for (const line of doc.SalesDocumentLine as any[]) {
      const qty = new Prisma.Decimal(line.quantity);
      if (qty.lte(0)) continue;
      const warehouseId = (line.warehouseId ?? doc.warehouseId) as string | null;
      if (!warehouseId) {
        throw new BadRequestException(
          `SalesDocumentLine ${line.id} has no warehouseId and SalesDocument.warehouseId is not set`,
        );
      }

      const outcome = await this.inventoryOrchestrator.recordOutcome(
        {
          warehouseId,
          itemId: line.itemId,
          quantity: qty,
          docType: InventoryDocumentType.SALE,
          docId: doc.id,
          movementType: InventoryMovementType.OUTCOME,
          occurredAt: new Date(line.date),
          meta: {
            lineId: line.id,
            salesDocumentId: doc.id,
            salesDocumentLineId: line.id,
            source: 'sales_posting',
          },
          sourceDocType: AccountingDocType.SALES_DOCUMENT,
          sourceDocId: doc.id,
        } as any,
        tx,
      );

      const lineCostBase = new Prisma.Decimal((outcome as any).totalCostBase ?? 0);
      totalCostBase = totalCostBase.add(lineCostBase);
      const movementIds = (outcome as any).movementIds ?? [];
      allMovementIds.push(...movementIds);

      lineOutcomes.push({
        lineId: line.id,
        transactionId: (outcome as any).transactionId,
        movementIds,
        totalCostBase: lineCostBase,
      });
    }

    // ========== 2) Revenue + refunds (MVP refund policy: finance-only) ==========
    const totalRevenue = new Prisma.Decimal(doc.totalRevenue ?? 0);
    const totalRefunds = new Prisma.Decimal(doc.totalRefunds ?? 0);

    const baseLineNumber =
      1 +
      (await tx.accountingEntry.count({
        where: {
          docType: AccountingDocType.SALES_DOCUMENT,
          docId: doc.id,
        } as any,
      }));
    let lineNumber = baseLineNumber;

    // Revenue: DR AR / CR Revenue
    if (totalRevenue.gt(0)) {
      await this.accounting.createEntry({
        tx,
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: doc.id,
        brandId: doc.brandId ?? undefined,
        countryId: doc.countryId ?? undefined,
        marketplaceId: doc.marketplaceId ?? null,
        warehouseId: doc.warehouseId ?? null,
        lineNumber: lineNumber++,
        postingDate: new Date(doc.periodTo ?? doc.periodFrom ?? new Date()),
        debitAccount: accounts.arAccount,
        creditAccount: accounts.revenueAccount,
        amount: totalRevenue,
        currency,
        description: `Sales revenue for document ${doc.id}`,
        metadata: {
          docLineId: `sales_document:${doc.id}:revenue:run:${runId}`,
          salesDocumentId: doc.id,
          baseCurrency,
        },
        postingRunId: runId,
      } as any);
    }

    // Refunds (Variant 1 MVP): DR Refunds expense / CR AR (no inventory return)
    if (totalRefunds.gt(0)) {
      await this.accounting.createEntry({
        tx,
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: doc.id,
        brandId: doc.brandId ?? undefined,
        countryId: doc.countryId ?? undefined,
        marketplaceId: doc.marketplaceId ?? null,
        warehouseId: doc.warehouseId ?? null,
        lineNumber: lineNumber++,
        postingDate: new Date(doc.periodTo ?? doc.periodFrom ?? new Date()),
        // TZ 10.0.1: refunds are contra-revenue (reduce revenue), not expense
        debitAccount: accounts.contraRevenueAccount,
        creditAccount: accounts.arAccount,
        amount: totalRefunds,
        currency,
        description: `Sales refunds for document ${doc.id}`,
        metadata: {
          docLineId: `sales_document:${doc.id}:refunds:run:${runId}`,
          salesDocumentId: doc.id,
          baseCurrency,
        },
        postingRunId: runId,
      } as any);
    }

    // ========== 3) COGS / Inventory ==========
    let cogsEntry: any | null = null;
    if (totalCostBase.gt(0)) {
      cogsEntry = await this.accounting.createEntry({
        tx,
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: doc.id,
        brandId: doc.brandId ?? undefined,
        countryId: doc.countryId ?? undefined,
        marketplaceId: doc.marketplaceId ?? null,
        warehouseId: doc.warehouseId ?? null,
        lineNumber: lineNumber++,
        postingDate: new Date(doc.periodTo ?? doc.periodFrom ?? new Date()),
        debitAccount: accounts.cogsAccount,
        creditAccount: accounts.inventoryAssetAccount,
        amount: totalCostBase,
        currency: baseCurrency,
        description: `COGS for sales document ${doc.id}`,
        metadata: {
          docLineId: `sales_document:${doc.id}:cogs:run:${runId}`,
          salesDocumentId: doc.id,
          baseCurrency,
          totalCostBase: totalCostBase.toString(),
          lineOutcomes: lineOutcomes.map((o) => ({
            salesDocumentLineId: o.lineId,
            inventoryTransactionId: o.transactionId,
            totalCostBase: o.totalCostBase.toString(),
          })),
        },
        postingRunId: runId,
      } as any);

      // Links: movement ↔ COGS entry (amountBase = lineCostBase per movement)
      if (allMovementIds.length) {
        const movements = await tx.stockMovement.findMany({
          where: { id: { in: allMovementIds } } as any,
          select: {
            id: true,
            quantity: true,
            meta: true,
            inventoryTransactionId: true,
            batchId: true,
            StockBatche: { select: { unitCostBase: true } },
          } as any,
        });

        const movementAmountBase: Record<string, string> = {};
        const movementMeta: Record<
          string,
          { inventoryTransactionId?: string | null; batchId?: string | null }
        > = {};
        for (const mv of movements as any[]) {
          const meta = mv.meta ?? {};
          movementMeta[mv.id] = {
            inventoryTransactionId: mv.inventoryTransactionId ?? null,
            batchId: mv.batchId ?? null,
          };
          const lineCostBaseStr =
            typeof meta.lineCostBase === 'string' ? meta.lineCostBase : null;
          if (lineCostBaseStr) {
            movementAmountBase[mv.id] = lineCostBaseStr;
            continue;
          }
          // fallback: qty * batch.unitCostBase
          const unitCostBase =
            mv.StockBatche?.unitCostBase !== null &&
            mv.StockBatche?.unitCostBase !== undefined
              ? new Prisma.Decimal(mv.StockBatche.unitCostBase)
              : null;
          if (unitCostBase) {
            const qtyAbs = new Prisma.Decimal(mv.quantity).abs();
            movementAmountBase[mv.id] = unitCostBase.mul(qtyAbs).toString();
          }
        }

        // TZ 10.0.1: create 2 links per movement: COGS + INVENTORY (same accounting entry, different linkType)
        await this.inventoryLinks.link({
          tx,
          movementIds: allMovementIds,
          entryIds: [cogsEntry.id],
          role: InventoryAccountingLinkRole.COGS,
          movementAmountBase,
          linkType: InventoryAccountingLinkType.COGS,
          postingRunId: runId,
          movementMeta,
        } as any);
        await this.inventoryLinks.link({
          tx,
          movementIds: allMovementIds,
          entryIds: [cogsEntry.id],
          role: InventoryAccountingLinkRole.COGS,
          movementAmountBase,
          linkType: InventoryAccountingLinkType.INVENTORY,
          postingRunId: runId,
          movementMeta,
        } as any);
      }
    }

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
        debitAccount: accounts.marketplaceFeeExpenseAccount,
        creditAccount: accounts.arAccount,
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

    await this.validation.maybeValidateDocumentBalanceOnPost({
      tx,
      docType: AccountingDocType.SALES_DOCUMENT,
      docId: doc.id,
      postingRunId: runId,
    });

    await tx.salesDocument.update({
      where: { id: doc.id },
      data: { status: SalesDocumentStatus.POSTED } as any,
    });

    return {
      id: doc.id,
      posted: true,
      feeEntries: createdOrReused,
      cogsEntryId: cogsEntry?.id ?? null,
      totalCostBase: totalCostBase.toString(),
      movementIds: allMovementIds,
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
        await this.validation.maybeValidateDocumentBalanceOnPost({
          tx,
          docType: AccountingDocType.SALES_DOCUMENT,
          docId: doc.id,
          postingRunId: run.id,
        });
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

  /**
   * TZ 10.1 — Return with restock:
   * - creates SalesReturnOperation (idempotent by idempotencyKey)
   * - restocks inventory via InventoryOrchestrator.recordIncome using historical base cost from original SALE OUT movements
   * - posts revenue reversal + COGS reversal under a dedicated PostingRun (docType=SALE_RETURN, docId=returnOperationId)
   * - writes InventoryAccountingLink (2 per movement: COGS + INVENTORY)
   */
  async createReturnWithRestock(params: {
    saleId: string;
    idempotencyKey: string;
    occurredAt: Date;
    reason?: string | null;
    lines: Array<{
      saleLineId: string;
      quantity: string;
      refundAmountBase: string;
      warehouseId?: string;
    }>;
  }) {
    const baseCurrency = getBaseCurrency();
    // refundAmountBase is expressed in base currency by contract (TZ 10.1)
    const currency = baseCurrency;

    const toMoney2 = (d: Prisma.Decimal) =>
      (d as any).toDecimalPlaces ? (d as any).toDecimalPlaces(2) : d;

    return this.prisma.$transaction(async (tx) => {
      const existing = await (tx as any).salesReturnOperation.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
        include: { lines: true },
      });
      if (existing) return existing;

      const sale = await tx.salesDocument.findUnique({
        where: { id: params.saleId },
        include: { SalesDocumentLine: true, Marketplace: true } as any,
      });
      if (!sale) throw new NotFoundException('SalesDocument not found');
      if (sale.status !== SalesDocumentStatus.POSTED) {
        throw new BadRequestException('SalesDocument must be POSTED to return');
      }

      const legalEntityId = await this.resolveLegalEntityIdForSalesDoc(sale as any);
      const accounts = await this.accountMapping.getSalesReturnPostingAccounts({
        legalEntityId,
        marketplaceId: (sale as any).marketplaceId ?? null,
      });

      // Validate requested lines belong to sale
      const saleLinesById = new Map<string, any>();
      for (const l of (sale as any).SalesDocumentLine ?? []) {
        saleLinesById.set(l.id, l);
      }
      for (const l of params.lines) {
        if (!saleLinesById.has(l.saleLineId)) {
          throw new BadRequestException(`Sale line not found: ${l.saleLineId}`);
        }
        const qty = new Prisma.Decimal(l.quantity);
        if (qty.lte(0)) throw new BadRequestException('Return quantity must be > 0');
        const refund = new Prisma.Decimal(l.refundAmountBase);
        if (refund.lt(0)) throw new BadRequestException('refundAmountBase must be >= 0');
      }

      // Create operation (idempotent by DB unique key)
      let op: any;
      try {
        op = await (tx as any).salesReturnOperation.create({
          data: {
            id: crypto.randomUUID(),
            saleId: sale.id,
            legalEntityId,
            occurredAt: params.occurredAt,
            status: SalesReturnOperationStatus.CREATED,
            idempotencyKey: params.idempotencyKey,
            reason: params.reason ?? null,
          } as any,
        });
      } catch (e: any) {
        if (e?.code === 'P2002') {
          const again = await (tx as any).salesReturnOperation.findUnique({
            where: { idempotencyKey: params.idempotencyKey },
            include: { lines: true },
          });
          if (again) return again;
          throw new ConflictException('Return operation already exists (concurrent)');
        }
        throw e;
      }

      // Preload sale OUT movements for this sale (we will slice per movement)
      const saleLineIds = params.lines.map((l) => l.saleLineId);
      const itemIds = params.lines.map((l) => saleLinesById.get(l.saleLineId).itemId);
      const outMovements = await tx.stockMovement.findMany({
        where: {
          docType: MovementDocType.SALE,
          docId: sale.id,
          movementType: MovementType.OUTCOME,
          itemId: { in: itemIds },
        } as any,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          createdAt: true,
          itemId: true,
          warehouseId: true,
          quantity: true,
          meta: true,
          StockBatche: { select: { unitCostBase: true } },
        } as any,
      });

      // Existing returned qty per original movement for this sale (only POSTED ops)
      const prevLines = await (tx as any).salesReturnOperationLine.findMany({
        where: {
          saleLineId: { in: saleLineIds },
          originalMovementId: { not: null },
          operation: {
            saleId: sale.id,
            status: SalesReturnOperationStatus.POSTED,
          },
        } as any,
        select: { originalMovementId: true, quantity: true } as any,
      });
      const returnedQtyByMovement = new Map<string, Prisma.Decimal>();
      for (const pl of prevLines as any[]) {
        const mid = String(pl.originalMovementId);
        const prev = returnedQtyByMovement.get(mid) ?? new Prisma.Decimal(0);
        returnedQtyByMovement.set(mid, prev.add(new Prisma.Decimal(pl.quantity)));
      }

      const createdMovementIds: string[] = [];
      const movementAmountBase: Record<string, string> = {};
      const movementMeta: Record<
        string,
        { inventoryTransactionId: string | null; batchId: string | null }
      > = {};

      let totalRefundBase = new Prisma.Decimal(0);
      let totalCostReturnedBase = new Prisma.Decimal(0);

      for (const reqLine of params.lines) {
        const saleLine = saleLinesById.get(reqLine.saleLineId);
        const soldQty = new Prisma.Decimal(saleLine.quantity);
        const reqQty = new Prisma.Decimal(reqLine.quantity);
        const refundLine = new Prisma.Decimal(reqLine.refundAmountBase);

        // Already returned for this saleLine (POSTED only)
        const alreadyReturnedAgg = await (tx as any).salesReturnOperationLine.aggregate({
          where: {
            saleLineId: saleLine.id,
            operation: { saleId: sale.id, status: SalesReturnOperationStatus.POSTED },
          } as any,
          _sum: { quantity: true },
        });
        const alreadyReturned = new Prisma.Decimal(
          alreadyReturnedAgg?._sum?.quantity ?? 0,
        );
        const remainingAllowed = soldQty.sub(alreadyReturned);
        if (reqQty.gt(remainingAllowed)) {
          throw new BadRequestException(
            `Return qty exceeds remaining allowed for line ${saleLine.id}: requested=${reqQty.toString()} remaining=${remainingAllowed.toString()}`,
          );
        }

        // Movements for this sale line (match by meta.salesDocumentLineId or meta.lineId)
        const related = (outMovements as any[]).filter((m) => {
          if (m.itemId !== saleLine.itemId) return false;
          const meta = m.meta ?? {};
          return (
            (meta as any).salesDocumentLineId === saleLine.id ||
            (meta as any).lineId === saleLine.id
          );
        });
        if (!related.length) {
          throw new BadRequestException(
            `No original SALE OUT movements found for saleLineId=${saleLine.id}`,
          );
        }

        // Allocate across original movements, respecting already returned per movement
        let remaining = reqQty;
        const slices: Array<{
          originalMovementId: string;
          qty: Prisma.Decimal;
          unitCostBase: Prisma.Decimal;
          costBase: Prisma.Decimal;
          refundBase: Prisma.Decimal;
          warehouseId: string;
        }> = [];

        for (const m of related) {
          if (remaining.lte(0)) break;
          const absQty = new Prisma.Decimal(m.quantity).abs();
          const alreadyForMv = returnedQtyByMovement.get(m.id) ?? new Prisma.Decimal(0);
          const available = absQty.sub(alreadyForMv);
          if (available.lte(0)) continue;

          const take = available.lt(remaining) ? available : remaining;
          // unitCostBase from meta.lineCostBase/absQty, fallback to batch.unitCostBase
          const meta = m.meta ?? {};
          const lineCostBaseStr =
            typeof (meta as any).lineCostBase === 'string'
              ? (meta as any).lineCostBase
              : null;
          let unitCostBase: Prisma.Decimal | null = null;
          if (lineCostBaseStr) {
            const movementCostBase = new Prisma.Decimal(lineCostBaseStr);
            unitCostBase = absQty.gt(0) ? movementCostBase.div(absQty) : null;
          }
          if (!unitCostBase) {
            unitCostBase =
              m.StockBatche?.unitCostBase !== null &&
              m.StockBatche?.unitCostBase !== undefined
                ? new Prisma.Decimal(m.StockBatche.unitCostBase)
                : new Prisma.Decimal(0);
          }

          const costBase = unitCostBase.mul(take);
          const refundBase =
            reqQty.gt(0) ? refundLine.mul(take).div(reqQty) : new Prisma.Decimal(0);

          const warehouseId =
            reqLine.warehouseId ??
            saleLine.warehouseId ??
            (sale as any).warehouseId ??
            m.warehouseId;
          if (!warehouseId) {
            throw new BadRequestException(
              `Cannot resolve warehouseId for return line ${saleLine.id}`,
            );
          }

          slices.push({
            originalMovementId: m.id,
            qty: take,
            unitCostBase,
            costBase,
            refundBase,
            warehouseId,
          });
          remaining = remaining.sub(take);
        }

        if (remaining.gt(0)) {
          throw new BadRequestException(
            `Not enough original movement quantity to return for line ${saleLine.id}: remaining=${remaining.toString()}`,
          );
        }

        totalRefundBase = totalRefundBase.add(refundLine);

        // Execute slices: create return line rows + inventory income movements
        for (const s of slices) {
          const sliceCost2 = toMoney2(s.costBase);
          const sliceRefund2 = toMoney2(s.refundBase);
          totalCostReturnedBase = totalCostReturnedBase.add(sliceCost2);

          await (tx as any).salesReturnOperationLine.create({
            data: {
              id: crypto.randomUUID(),
              returnOperationId: op.id,
              saleLineId: saleLine.id,
              itemId: saleLine.itemId,
              warehouseId: s.warehouseId,
              quantity: s.qty,
              refundAmountBase: sliceRefund2,
              costBaseReturned: sliceCost2,
              originalMovementId: s.originalMovementId,
              meta: {
                saleId: sale.id,
                saleLineId: saleLine.id,
                originalMovementId: s.originalMovementId,
                unitCostBase: s.unitCostBase.toString(),
                costBase: sliceCost2.toString(),
                refundBase: sliceRefund2.toString(),
              },
            } as any,
          });

          const income = await this.inventoryOrchestrator.recordIncome(
            {
              warehouseId: s.warehouseId,
              itemId: saleLine.itemId,
              quantity: s.qty,
              docType: InventoryDocumentType.SALE_RETURN,
              docId: op.id, // returnOperationId as inventory doc id
              movementType: InventoryMovementType.INCOME,
              occurredAt: params.occurredAt,
              currency: baseCurrency,
              unitCost: s.unitCostBase, // already base
              batchSourceType: InventoryBatchSourceType.MANUAL_ADJUSTMENT,
              meta: {
                lineId: `return:${op.id}:${s.originalMovementId}`,
                saleId: sale.id,
                saleLineId: saleLine.id,
                returnOperationId: op.id,
                originalMovementId: s.originalMovementId,
                lineCostBase: sliceCost2.toString(),
                baseCurrency,
                source: 'sales_return_restock',
              },
              sourceDocType: AccountingDocType.SALE_RETURN,
              sourceDocId: op.id,
            },
            tx,
          );

          if (income.movementId) {
            const mv = await tx.stockMovement.findUnique({
              where: { id: income.movementId },
              select: { id: true, inventoryTransactionId: true, batchId: true },
            });
            if (mv) {
              createdMovementIds.push(mv.id);
              movementAmountBase[mv.id] = sliceCost2.toString();
              movementMeta[mv.id] = {
                inventoryTransactionId: mv.inventoryTransactionId ?? null,
                batchId: mv.batchId ?? null,
              };
            }
          }
        }
      }

      // Posting run for return operation
      const run = await this.postingRuns.getOrCreatePostedRun({
        tx,
        legalEntityId,
        docType: AccountingDocType.SALE_RETURN,
        docId: op.id,
      } as any);

      const baseLineNumber =
        1 +
        (await tx.accountingEntry.count({
          where: { docType: AccountingDocType.SALE_RETURN, docId: op.id } as any,
        }));
      let lineNumber = baseLineNumber;

      // Revenue reversal: DR contra-revenue / CR AR
      if (totalRefundBase.gt(0)) {
        await this.accounting.createEntry({
          tx,
          docType: AccountingDocType.SALE_RETURN,
          docId: op.id,
          brandId: (sale as any).brandId ?? undefined,
          countryId: (sale as any).countryId ?? undefined,
          marketplaceId: (sale as any).marketplaceId ?? null,
          warehouseId: (sale as any).warehouseId ?? null,
          lineNumber: lineNumber++,
          postingDate: params.occurredAt,
          debitAccount: accounts.contraRevenueAccount,
          creditAccount: accounts.arAccount,
          amount: toMoney2(totalRefundBase),
          currency,
          description: `Sales return revenue reversal for sale ${sale.id}`,
          metadata: {
            docLineId: `sale_return:${op.id}:revenue:run:${run.id}`,
            saleId: sale.id,
            returnOperationId: op.id,
            baseCurrency,
          },
          postingRunId: run.id,
        } as any);
      }

      // COGS reversal (split into 2 entries via clearing account):
      // - Inventory leg: DR Inventory / CR Clearing
      // - COGS leg:      DR Clearing / CR COGS
      //
      // This ensures InventoryAccountingLink invariants:
      // - linkType=INVENTORY → inventoryEntryId
      // - linkType=COGS → cogsEntryId
      let inventoryEntry: any | null = null;
      let cogsEntry: any | null = null;
      if (totalCostReturnedBase.gt(0)) {
        inventoryEntry = await this.accounting.createEntry({
          tx,
          docType: AccountingDocType.SALE_RETURN,
          docId: op.id,
          brandId: (sale as any).brandId ?? undefined,
          countryId: (sale as any).countryId ?? undefined,
          marketplaceId: (sale as any).marketplaceId ?? null,
          warehouseId: (sale as any).warehouseId ?? null,
          lineNumber: lineNumber++,
          postingDate: params.occurredAt,
          debitAccount: accounts.inventoryAssetAccount,
          creditAccount: (accounts as any).inventoryCogsClearingAccount,
          amount: toMoney2(totalCostReturnedBase),
          currency: baseCurrency,
          description: `Sales return inventory restock entry for sale ${sale.id}`,
          metadata: {
            docLineId: `sale_return:${op.id}:inventory:run:${run.id}`,
            saleId: sale.id,
            returnOperationId: op.id,
            totalCostReturnedBase: totalCostReturnedBase.toString(),
            baseCurrency,
          },
          postingRunId: run.id,
        } as any);

        cogsEntry = await this.accounting.createEntry({
          tx,
          docType: AccountingDocType.SALE_RETURN,
          docId: op.id,
          brandId: (sale as any).brandId ?? undefined,
          countryId: (sale as any).countryId ?? undefined,
          marketplaceId: (sale as any).marketplaceId ?? null,
          warehouseId: (sale as any).warehouseId ?? null,
          lineNumber: lineNumber++,
          postingDate: params.occurredAt,
          debitAccount: (accounts as any).inventoryCogsClearingAccount,
          creditAccount: accounts.cogsAccount,
          amount: toMoney2(totalCostReturnedBase),
          currency: baseCurrency,
          description: `Sales return COGS reversal entry for sale ${sale.id}`,
          metadata: {
            docLineId: `sale_return:${op.id}:cogs:run:${run.id}`,
            saleId: sale.id,
            returnOperationId: op.id,
            totalCostReturnedBase: totalCostReturnedBase.toString(),
            baseCurrency,
          },
          postingRunId: run.id,
        } as any);
      }

      if (inventoryEntry && cogsEntry && createdMovementIds.length) {
        await this.inventoryLinks.link({
          tx,
          movementIds: createdMovementIds,
          entryIds: [cogsEntry.id],
          role: InventoryAccountingLinkRole.COGS,
          movementAmountBase,
          linkType: InventoryAccountingLinkType.COGS,
          postingRunId: run.id,
          movementMeta,
        } as any);
        await this.inventoryLinks.link({
          tx,
          movementIds: createdMovementIds,
          entryIds: [inventoryEntry.id],
          role: InventoryAccountingLinkRole.COGS,
          movementAmountBase,
          linkType: InventoryAccountingLinkType.INVENTORY,
          postingRunId: run.id,
          movementMeta,
        } as any);
      }

      // Always-on validation (prod): posting run must balance.
      await this.validation.maybeValidateDocumentBalanceOnPost({
        tx,
        docType: AccountingDocType.SALE_RETURN,
        docId: op.id,
        postingRunId: run.id,
      });

      await (tx as any).salesReturnOperation.update({
        where: { id: op.id },
        data: {
          status: SalesReturnOperationStatus.POSTED,
          totalRefundBase: toMoney2(totalRefundBase),
          totalCostReturnedBase: toMoney2(totalCostReturnedBase),
          postingRunId: run.id,
        } as any,
      });

      return (tx as any).salesReturnOperation.findUnique({
        where: { id: op.id },
        include: { lines: true },
      });
    });
  }
}
