import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingDocType,
  MoneyTransactionSourceType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  ExplainItem,
  ExplainLink,
  ExplainPayload,
  PrimaryRef,
} from './explain.types';

function endOfDay(d: Date): Date {
  const dt = new Date(d);
  dt.setHours(23, 59, 59, 999);
  return dt;
}

function startOfDay(d: Date): Date {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

@Injectable()
export class ExplainService {
  constructor(private readonly prisma: PrismaService) {}

  private parseDate(s: string, label: string, mode: 'start' | 'end'): Date {
    const d = new Date(s);
    if (Number.isNaN(d.getTime()))
      throw new BadRequestException(`${label} is invalid`);
    return mode === 'start' ? startOfDay(d) : endOfDay(d);
  }

  private async ensureEntryLegalEntity(
    entryIds: string[],
    legalEntityId: string,
  ) {
    if (!entryIds.length) return;
    const bad = await this.prisma.accountingEntry.findFirst({
      where: {
        id: { in: entryIds },
        legalEntityId: { not: legalEntityId },
      } as any,
      select: { id: true },
    });
    if (bad) throw new ForbiddenException('legalEntity scope violation');
  }

  private async ensureMoneyTxLegalEntity(
    txIds: string[],
    legalEntityId: string,
  ) {
    if (!txIds.length) return;
    const bad = await this.prisma.moneyTransaction.findFirst({
      where: {
        id: { in: txIds },
        account: { legalEntityId: { not: legalEntityId } },
      } as any,
      select: { id: true },
    });
    if (bad) throw new ForbiddenException('legalEntity scope violation');
  }

  private buildPrimaryIndex(rows: PrimaryRef[]) {
    const map = new Map<string, PrimaryRef>();
    for (const r of rows) map.set(`${r.type}:${r.id}`, r);
    return map;
  }

  private titleForDocType(docType: AccountingDocType, docId: string) {
    return `${docType} ${docId}`;
  }

  private async batchPrimaryRefs(params: {
    financialDocumentIds: string[];
    paymentExecutionIds: string[];
    statementLineIds: string[];
    acquiringEventIds: string[];
    moneyTransactionIds: string[];
    stockMovementIds: string[];
    salesDocumentIds: string[];
    supplyReceiptIds?: string[];
    productionOrderIds?: string[];
    inventoryTransactionIds?: string[];
    cashTransferIds?: string[];
  }): Promise<Map<string, PrimaryRef>> {
    const refs: PrimaryRef[] = [];

    if (params.financialDocumentIds.length) {
      const docs = await this.prisma.financialDocument.findMany({
        where: { id: { in: params.financialDocumentIds } },
        select: {
          id: true,
          type: true,
          docNumber: true,
          currency: true,
          amountTotal: true,
        },
      });
      for (const d of docs) {
        refs.push({
          type: 'FinancialDocument',
          id: d.id,
          display: {
            title: `FinancialDocument ${(d as any).docNumber ?? d.id}`,
            subtitle:
              `${d.type ?? 'UNKNOWN'} ${d.currency ?? ''} ${(d.amountTotal as any)?.toString?.() ?? ''}`.trim(),
          },
        });
      }
    }

    if (params.paymentExecutionIds.length) {
      const execs = await this.prisma.paymentExecution.findMany({
        where: { id: { in: params.paymentExecutionIds } },
        select: { id: true, executedAt: true, amount: true, currency: true },
      });
      for (const e of execs) {
        refs.push({
          type: 'PaymentExecution',
          id: e.id,
          display: {
            title: `PaymentExecution ${e.id}`,
            subtitle: `${e.currency} ${(e.amount as any)?.toString?.() ?? ''} @ ${e.executedAt.toISOString()}`,
          },
        });
      }
    }

    if (params.statementLineIds.length) {
      const lines = await (this.prisma as any).statementLine.findMany({
        where: { id: { in: params.statementLineIds } },
        select: {
          id: true,
          occurredAt: true,
          amount: true,
          currency: true,
          description: true,
        },
      });
      for (const l of lines) {
        refs.push({
          type: 'StatementLine',
          id: l.id,
          display: {
            title: `StatementLine ${l.id}`,
            subtitle: l.description ?? null,
          },
        } as any);
      }
    }

    if (params.acquiringEventIds.length) {
      const events = await (this.prisma as any).acquiringEvent.findMany({
        where: { id: { in: params.acquiringEventIds } },
        select: {
          id: true,
          provider: true,
          eventType: true,
          occurredAt: true,
          amount: true,
          currency: true,
        },
      });
      for (const ev of events) {
        refs.push({
          type: 'AcquiringEvent',
          id: ev.id,
          display: {
            title: `AcquiringEvent ${ev.provider} ${ev.eventType}`,
            subtitle: `${ev.currency} ${ev.amount?.toString?.() ?? ''} @ ${ev.occurredAt.toISOString()}`,
          },
        });
      }
    }

    if (params.moneyTransactionIds.length) {
      const txs = await this.prisma.moneyTransaction.findMany({
        where: { id: { in: params.moneyTransactionIds } },
        select: {
          id: true,
          occurredAt: true,
          direction: true,
          amount: true,
          currency: true,
          description: true,
        },
      });
      for (const t of txs) {
        refs.push({
          type: 'MoneyTransaction',
          id: t.id,
          display: {
            title: `MoneyTx ${t.direction}`,
            subtitle:
              t.description ??
              `${t.currency} ${(t.amount as any)?.toString?.() ?? ''}`,
          },
        } as any);
      }
    }

    if (params.stockMovementIds.length) {
      const moves = await (this.prisma as any).stockMovement.findMany({
        where: { id: { in: params.stockMovementIds } },
        select: {
          id: true,
          createdAt: true,
          docType: true,
          movementType: true,
        },
      });
      for (const m of moves) {
        refs.push({
          type: 'StockMovement',
          id: m.id,
          display: {
            title: `StockMovement ${m.docType ?? ''}`.trim(),
            subtitle: m.movementType ?? undefined,
          },
        } as any);
      }
    }

    if (params.salesDocumentIds.length) {
      const sds = await (this.prisma as any).salesDocument.findMany({
        where: { id: { in: params.salesDocumentIds } },
        select: { id: true, externalId: true },
      });
      for (const s of sds) {
        refs.push({
          type: 'SalesDocument',
          id: s.id,
          display: { title: `SalesDocument ${s.externalId ?? s.id}` },
        });
      }
    }

    if (params.supplyReceiptIds?.length) {
      const receipts = await (this.prisma as any).scmSupplyReceipt.findMany({
        where: { id: { in: params.supplyReceiptIds } },
        select: { id: true, supplyId: true, receiptDate: true },
      });
      for (const r of receipts) {
        refs.push({
          type: 'ScmSupplyReceipt',
          id: r.id,
          display: {
            title: `SupplyReceipt ${r.id}`,
            subtitle:
              `${r.supplyId ?? ''} @ ${r.receiptDate?.toISOString?.() ?? ''}`.trim(),
          },
        } as any);
      }
    }

    if (params.productionOrderIds?.length) {
      const orders = await (this.prisma as any).productionOrder.findMany({
        where: { id: { in: params.productionOrderIds } },
        select: { id: true, code: true, name: true, status: true },
      });
      for (const o of orders) {
        refs.push({
          type: 'ProductionOrder',
          id: o.id,
          display: {
            title: `ProductionOrder ${o.code ?? o.id}`,
            subtitle: o.name ?? o.status ?? undefined,
          },
        } as any);
      }
    }

    if (params.inventoryTransactionIds?.length) {
      const txns = await (this.prisma as any).inventoryTransaction.findMany({
        where: { id: { in: params.inventoryTransactionIds } },
        select: { id: true, docType: true, docId: true, createdAt: true },
      });
      for (const t of txns) {
        refs.push({
          type: 'InventoryTransaction',
          id: t.id,
          display: {
            title: `InventoryTx ${t.docType ?? ''}`.trim(),
            subtitle: t.docId ?? undefined,
          },
        } as any);
      }
    }

    if (params.cashTransferIds?.length) {
      const transfers = await (this.prisma as any).cashTransfer.findMany({
        where: { id: { in: params.cashTransferIds } },
        select: { id: true, provider: true, externalRef: true, status: true },
      });
      for (const t of transfers) {
        refs.push({
          type: 'CashTransfer',
          id: t.id,
          display: {
            title: `CashTransfer ${t.provider ?? ''}`.trim(),
            subtitle: t.externalRef ?? t.status ?? undefined,
          },
        } as any);
      }
    }

    return this.buildPrimaryIndex(refs);
  }

  async explainBalanceSheet(params: {
    legalEntityId: string;
    at: string;
    accountId: string;
    from?: string;
    limit: number;
    offset: number;
  }): Promise<ExplainPayload> {
    const legalEntityId = (params.legalEntityId ?? '').trim();
    if (!legalEntityId)
      throw new BadRequestException('legalEntityId is required');
    const accountId = (params.accountId ?? '').trim();
    if (!accountId) throw new BadRequestException('accountId is required');
    const at = this.parseDate(params.at, 'at', 'end');
    const from = params.from
      ? this.parseDate(params.from, 'from', 'start')
      : null;

    const where: Prisma.AccountingEntryWhereInput = {
      legalEntityId,
      postingDate: { lte: at, ...(from ? { gte: from } : {}) } as any,
      OR: [{ debitAccount: accountId }, { creditAccount: accountId }],
    };

    const [entries, total] = await Promise.all([
      this.prisma.accountingEntry.findMany({
        where,
        orderBy: [{ postingDate: 'desc' }, { lineNumber: 'desc' }],
        take: params.limit,
        skip: params.offset,
        select: {
          id: true,
          postingDate: true,
          docType: true,
          docId: true,
          debitAccount: true,
          creditAccount: true,
          amountBase: true,
          currency: true,
          metadata: true,
        },
      }),
      this.prisma.accountingEntry.count({ where }),
    ]);

    const entryIds = entries.map((e) => e.id);
    await this.ensureEntryLegalEntity(entryIds, legalEntityId);

    const cashLinks = await this.prisma.cashAccountingLink.findMany({
      where: { accountingEntryId: { in: entryIds } } as any,
      select: {
        id: true,
        role: true,
        moneyTransactionId: true,
        accountingEntryId: true,
      },
    });
    const acquiringLinks = await (
      this.prisma as any
    ).acquiringAccountingLink.findMany({
      where: { accountingEntryId: { in: entryIds } } as any,
      select: {
        id: true,
        role: true,
        acquiringEventId: true,
        accountingEntryId: true,
      },
    });
    const inventoryLinks = await (
      this.prisma as any
    ).inventoryAccountingLink.findMany({
      where: { accountingEntryId: { in: entryIds } } as any,
      select: {
        id: true,
        role: true,
        stockMovementId: true,
        accountingEntryId: true,
      },
    });

    const moneyTxIds = Array.from(
      new Set(cashLinks.map((l) => l.moneyTransactionId)),
    );
    await this.ensureMoneyTxLegalEntity(moneyTxIds, legalEntityId);
    const moneyTxs = moneyTxIds.length
      ? await this.prisma.moneyTransaction.findMany({
          where: { id: { in: moneyTxIds } } as any,
          select: {
            id: true,
            occurredAt: true,
            direction: true,
            amountBase: true,
            currency: true,
            sourceType: true,
            sourceId: true,
            description: true,
          },
        })
      : [];

    const statementLineIdsFromTx = moneyTxs
      .filter(
        (t) =>
          t.sourceType === MoneyTransactionSourceType.STATEMENT_LINE &&
          t.sourceId,
      )
      .map((t) => t.sourceId!);

    const statementLineIdsFromAcq = acquiringLinks
      .map((l: any) => l.acquiringEventId)
      .filter(Boolean) as string[];

    // Primary ids from entries
    const financialDocumentIds: string[] = [];
    const paymentExecutionIds: string[] = [];
    const salesDocumentIds: string[] = [];
    const acquiringEventIds: string[] = [];
    const statementLineIds: string[] = [];
    const stockMovementIds: string[] = [];
    const supplyReceiptIds: string[] = [];
    const productionOrderIds: string[] = [];
    const inventoryTransactionIds: string[] = [];
    const cashTransferIds: string[] = [];

    for (const e of entries as any[]) {
      if (
        e.docType === AccountingDocType.FINANCIAL_DOCUMENT ||
        e.docType === AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL ||
        e.docType === AccountingDocType.FINANCIAL_DOCUMENT_RECOGNITION
      ) {
        financialDocumentIds.push(e.docId);
      }
      if (e.docType === AccountingDocType.PAYMENT_EXECUTION)
        paymentExecutionIds.push(e.docId);
      if (e.docType === AccountingDocType.SALES_DOCUMENT)
        salesDocumentIds.push(e.docId);
      if (e.docType === AccountingDocType.ACQUIRING_EVENT)
        acquiringEventIds.push(e.docId);
      if (e.docType === AccountingDocType.STATEMENT_LINE_FEE)
        statementLineIds.push(e.docId);
      if (e.docType === AccountingDocType.SUPPLY_RECEIPT)
        supplyReceiptIds.push(e.docId);
      if (e.docType === AccountingDocType.PRODUCTION_COMPLETION)
        productionOrderIds.push(e.docId);
      if (e.docType === AccountingDocType.PRODUCTION_CONSUMPTION)
        inventoryTransactionIds.push(e.docId);
      if (e.docType === 'MARKETPLACE_PAYOUT_TRANSFER')
        cashTransferIds.push(e.docId);

      const fdFromMeta = e.metadata?.financialDocumentId;
      if (fdFromMeta) financialDocumentIds.push(String(fdFromMeta));

      const poFromMeta = e.metadata?.productionOrderId;
      if (poFromMeta) productionOrderIds.push(String(poFromMeta));
    }

    // Statement lines from tx sources
    statementLineIds.push(...statementLineIdsFromTx);

    // Statement lines linked to acquiring events
    const acquiringEventToStatementLineId = new Map<string, string>();
    if (acquiringLinks.length) {
      const evs = await (this.prisma as any).acquiringEvent.findMany({
        where: {
          id: { in: acquiringLinks.map((l: any) => l.acquiringEventId) },
        } as any,
        select: { id: true, statementLineId: true },
      });
      for (const ev of evs) {
        if (ev.statementLineId) statementLineIds.push(ev.statementLineId);
        if (ev.statementLineId)
          acquiringEventToStatementLineId.set(ev.id, ev.statementLineId);
      }
    }

    for (const l of inventoryLinks as any[]) {
      stockMovementIds.push(l.stockMovementId);
    }

    for (const l of acquiringLinks as any[]) {
      acquiringEventIds.push(l.acquiringEventId);
    }

    // Derive production order from inventory transactions (for PRODUCTION_CONSUMPTION docId)
    if (inventoryTransactionIds.length) {
      const inv = await (this.prisma as any).inventoryTransaction.findMany({
        where: { id: { in: Array.from(new Set(inventoryTransactionIds)) } },
        select: { id: true, docType: true, docId: true },
      });
      for (const it of inv) {
        if (it.docType === 'PRODUCTION_INPUT' && it.docId)
          productionOrderIds.push(it.docId);
      }
    }

    const primaryIndex = await this.batchPrimaryRefs({
      financialDocumentIds: Array.from(new Set(financialDocumentIds)),
      paymentExecutionIds: Array.from(new Set(paymentExecutionIds)),
      statementLineIds: Array.from(new Set(statementLineIds)),
      acquiringEventIds: Array.from(new Set(acquiringEventIds)),
      moneyTransactionIds: Array.from(new Set(moneyTxIds)),
      stockMovementIds: Array.from(new Set(stockMovementIds)),
      salesDocumentIds: Array.from(new Set(salesDocumentIds)),
      supplyReceiptIds: Array.from(new Set(supplyReceiptIds)),
      productionOrderIds: Array.from(new Set(productionOrderIds)),
      inventoryTransactionIds: Array.from(new Set(inventoryTransactionIds)),
      cashTransferIds: Array.from(new Set(cashTransferIds)),
    });

    const linksByEntry = new Map<string, ExplainLink[]>();
    const primaryByEntry = new Map<string, PrimaryRef[]>();

    const add = (map: Map<string, any[]>, key: string, val: any) => {
      const cur = map.get(key) ?? [];
      cur.push(val);
      map.set(key, cur);
    };

    for (const l of cashLinks) {
      add(linksByEntry, l.accountingEntryId, {
        type: 'CASH',
        role: String(l.role),
        from: { type: 'MoneyTransaction', id: l.moneyTransactionId },
        to: { type: 'AccountingEntry', id: l.accountingEntryId },
      });
      const pr = primaryIndex.get(`MoneyTransaction:${l.moneyTransactionId}`);
      if (pr) add(primaryByEntry, l.accountingEntryId, pr);
    }
    for (const l of acquiringLinks as any[]) {
      add(linksByEntry, l.accountingEntryId, {
        type: 'ACQUIRING',
        role: String(l.role ?? ''),
        from: { type: 'AcquiringEvent', id: l.acquiringEventId },
        to: { type: 'AccountingEntry', id: l.accountingEntryId },
      });
      const pr = primaryIndex.get(`AcquiringEvent:${l.acquiringEventId}`);
      if (pr) add(primaryByEntry, l.accountingEntryId, pr);

      const slId = acquiringEventToStatementLineId.get(l.acquiringEventId);
      if (slId) {
        const sl = primaryIndex.get(`StatementLine:${slId}`);
        if (sl) add(primaryByEntry, l.accountingEntryId, sl);
      }
    }
    for (const l of inventoryLinks as any[]) {
      add(linksByEntry, l.accountingEntryId, {
        type: 'INVENTORY',
        role: String(l.role ?? ''),
        from: { type: 'StockMovement', id: l.stockMovementId },
        to: { type: 'AccountingEntry', id: l.accountingEntryId },
      });
      const pr = primaryIndex.get(`StockMovement:${l.stockMovementId}`);
      if (pr) add(primaryByEntry, l.accountingEntryId, pr);
    }

    // add direct primary from docType/docId
    for (const e of entries as any[]) {
      const k = e.id;
      const p: PrimaryRef[] = primaryByEntry.get(k) ?? [];

      const directKey =
        e.docType === AccountingDocType.PAYMENT_EXECUTION
          ? `PaymentExecution:${e.docId}`
          : e.docType === AccountingDocType.ACQUIRING_EVENT
            ? `AcquiringEvent:${e.docId}`
            : e.docType === AccountingDocType.SUPPLY_RECEIPT
              ? `ScmSupplyReceipt:${e.docId}`
              : e.docType === AccountingDocType.PRODUCTION_COMPLETION
                ? `ProductionOrder:${e.docId}`
                : e.docType === AccountingDocType.PRODUCTION_CONSUMPTION
                  ? `InventoryTransaction:${e.docId}`
                  : e.docType === AccountingDocType.STATEMENT_LINE_FEE
                    ? `StatementLine:${e.docId}`
                    : e.docType === AccountingDocType.SALES_DOCUMENT
                      ? `SalesDocument:${e.docId}`
                      : e.docType === AccountingDocType.FINANCIAL_DOCUMENT ||
                          e.docType ===
                            AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL ||
                          e.docType ===
                            AccountingDocType.FINANCIAL_DOCUMENT_RECOGNITION
                        ? `FinancialDocument:${e.docId}`
                        : null;
      if (directKey) {
        const pr = primaryIndex.get(directKey);
        if (pr) p.push(pr);
      }
      const fdFromMeta = e.metadata?.financialDocumentId;
      if (fdFromMeta) {
        const pr = primaryIndex.get(`FinancialDocument:${String(fdFromMeta)}`);
        if (pr) p.push(pr);
      }
      primaryByEntry.set(
        k,
        Array.from(new Map(p.map((x) => [`${x.type}:${x.id}`, x])).values()),
      );
    }

    const items: ExplainItem[] = entries.map((e: any) => ({
      kind: 'ACCOUNTING_ENTRY_LINE',
      id: e.id,
      occurredAt: e.postingDate.toISOString(),
      amountBase: e.amountBase?.toNumber?.() ?? Number(e.amountBase ?? 0),
      currency: e.currency,
      debitAccountId: e.debitAccount,
      creditAccountId: e.creditAccount,
      docType: e.docType,
      docId: e.docId,
      title: this.titleForDocType(e.docType, e.docId),
      meta: { docLineId: e.metadata?.docLineId ?? null },
      links: linksByEntry.get(e.id) ?? [],
      primary: primaryByEntry.get(e.id) ?? [],
    }));

    return {
      scope: { legalEntityId },
      context: {
        kind: 'BS',
        at: at.toISOString(),
        from: from ? from.toISOString() : undefined,
      },
      items,
      page: { limit: params.limit, offset: params.offset, total },
    };
  }

  async explainCashflow(params: {
    legalEntityId: string;
    from: string;
    to: string;
    cashflowCategoryId: string;
    limit: number;
    offset: number;
  }): Promise<ExplainPayload> {
    const legalEntityId = (params.legalEntityId ?? '').trim();
    if (!legalEntityId)
      throw new BadRequestException('legalEntityId is required');
    const from = this.parseDate(params.from, 'from', 'start');
    const to = this.parseDate(params.to, 'to', 'end');
    if (to < from) throw new BadRequestException('to must be >= from');
    const cashflowCategoryId = (params.cashflowCategoryId ?? '').trim();
    if (!cashflowCategoryId)
      throw new BadRequestException('cashflowCategoryId is required');

    const accounts = await this.prisma.financialAccount.findMany({
      where: { legalEntityId } as any,
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    const where: Prisma.MoneyTransactionWhereInput = {
      accountId: { in: accountIds },
      occurredAt: { gte: from, lte: to },
      cashflowCategoryId,
    } as any;

    const [txs, total] = await Promise.all([
      this.prisma.moneyTransaction.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        take: params.limit,
        skip: params.offset,
        select: {
          id: true,
          occurredAt: true,
          direction: true,
          amountBase: true,
          currency: true,
          description: true,
          sourceType: true,
          sourceId: true,
        },
      }),
      this.prisma.moneyTransaction.count({ where }),
    ]);

    const txIds = txs.map((t) => t.id);
    await this.ensureMoneyTxLegalEntity(txIds, legalEntityId);

    const cashLinks = await this.prisma.cashAccountingLink.findMany({
      where: { moneyTransactionId: { in: txIds } } as any,
      select: {
        id: true,
        role: true,
        moneyTransactionId: true,
        accountingEntryId: true,
      },
    });

    const entryIds = Array.from(
      new Set(cashLinks.map((l) => l.accountingEntryId)),
    );
    await this.ensureEntryLegalEntity(entryIds, legalEntityId);
    const entries = entryIds.length
      ? await this.prisma.accountingEntry.findMany({
          where: { id: { in: entryIds } } as any,
          select: {
            id: true,
            docType: true,
            docId: true,
            postingDate: true,
            debitAccount: true,
            creditAccount: true,
            amountBase: true,
            currency: true,
            metadata: true,
          },
        })
      : [];

    const statementLineIds = txs
      .filter(
        (t) =>
          t.sourceType === MoneyTransactionSourceType.STATEMENT_LINE &&
          t.sourceId,
      )
      .map((t) => t.sourceId!);

    // Also attach statement lines that reconciled (posted) these moneyTx (common for PAYMENT_EXECUTION sourceType)
    const reconciledLines = await (this.prisma as any).statementLine.findMany({
      where: {
        postedMoneyTransactionId: { in: txIds },
        status: 'POSTED',
      } as any,
      select: { id: true, postedMoneyTransactionId: true },
      take: 5000,
    });
    for (const l of reconciledLines) statementLineIds.push(l.id);

    const financialDocumentIds: string[] = [];
    const paymentExecutionIds: string[] = [];
    const acquiringEventIds: string[] = [];
    const salesDocumentIds: string[] = [];

    for (const e of entries as any[]) {
      if (
        e.docType === AccountingDocType.FINANCIAL_DOCUMENT ||
        e.docType === AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL ||
        e.docType === AccountingDocType.FINANCIAL_DOCUMENT_RECOGNITION
      ) {
        financialDocumentIds.push(e.docId);
      }
      if (e.docType === AccountingDocType.PAYMENT_EXECUTION)
        paymentExecutionIds.push(e.docId);
      if (e.docType === AccountingDocType.ACQUIRING_EVENT)
        acquiringEventIds.push(e.docId);
      if (e.docType === AccountingDocType.SALES_DOCUMENT)
        salesDocumentIds.push(e.docId);
      const fdFromMeta = e.metadata?.financialDocumentId;
      if (fdFromMeta) financialDocumentIds.push(String(fdFromMeta));
    }

    const primaryIndex = await this.batchPrimaryRefs({
      financialDocumentIds: Array.from(new Set(financialDocumentIds)),
      paymentExecutionIds: Array.from(new Set(paymentExecutionIds)),
      statementLineIds: Array.from(new Set(statementLineIds)),
      acquiringEventIds: Array.from(new Set(acquiringEventIds)),
      moneyTransactionIds: Array.from(new Set(txIds)),
      stockMovementIds: [],
      salesDocumentIds: Array.from(new Set(salesDocumentIds)),
      supplyReceiptIds: [],
      productionOrderIds: [],
      inventoryTransactionIds: [],
      cashTransferIds: [],
    });

    const linksByTx = new Map<string, ExplainLink[]>();
    const primaryByTx = new Map<string, PrimaryRef[]>();
    const add = (map: Map<string, any[]>, key: string, val: any) => {
      const cur = map.get(key) ?? [];
      cur.push(val);
      map.set(key, cur);
    };

    const entryById = new Map(entries.map((e: any) => [e.id, e]));

    for (const l of cashLinks) {
      add(linksByTx, l.moneyTransactionId, {
        type: 'CASH',
        role: String(l.role),
        from: { type: 'MoneyTransaction', id: l.moneyTransactionId },
        to: { type: 'AccountingEntry', id: l.accountingEntryId },
      });

      const prTx = primaryIndex.get(`MoneyTransaction:${l.moneyTransactionId}`);
      if (prTx) add(primaryByTx, l.moneyTransactionId, prTx);

      const entry = entryById.get(l.accountingEntryId);
      if (entry) {
        const direct =
          entry.docType === AccountingDocType.PAYMENT_EXECUTION
            ? `PaymentExecution:${entry.docId}`
            : entry.docType === AccountingDocType.ACQUIRING_EVENT
              ? `AcquiringEvent:${entry.docId}`
              : entry.docType === AccountingDocType.SALES_DOCUMENT
                ? `SalesDocument:${entry.docId}`
                : entry.docType === AccountingDocType.FINANCIAL_DOCUMENT ||
                    entry.docType ===
                      AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL ||
                    entry.docType ===
                      AccountingDocType.FINANCIAL_DOCUMENT_RECOGNITION
                  ? `FinancialDocument:${entry.docId}`
                  : null;
        if (direct) {
          const pr = primaryIndex.get(direct);
          if (pr) add(primaryByTx, l.moneyTransactionId, pr);
        }
        const fdFromMeta = entry.metadata?.financialDocumentId;
        if (fdFromMeta) {
          const pr = primaryIndex.get(
            `FinancialDocument:${String(fdFromMeta)}`,
          );
          if (pr) add(primaryByTx, l.moneyTransactionId, pr);
        }
      }
    }

    // statement line primary from tx source
    for (const t of txs as any[]) {
      if (
        t.sourceType === MoneyTransactionSourceType.STATEMENT_LINE &&
        t.sourceId
      ) {
        const pr = primaryIndex.get(`StatementLine:${t.sourceId}`);
        if (pr) add(primaryByTx, t.id, pr);
      }
    }

    // statement line primary from reconciliation linkage
    for (const l of reconciledLines as any[]) {
      const pr = primaryIndex.get(`StatementLine:${l.id}`);
      if (pr) add(primaryByTx, l.postedMoneyTransactionId, pr);
    }

    const items: ExplainItem[] = txs.map((t: any) => ({
      kind: 'MONEY_TRANSACTION',
      id: t.id,
      occurredAt: t.occurredAt.toISOString(),
      amountBase: t.amountBase?.toNumber?.() ?? Number(t.amountBase ?? 0),
      currency: t.currency,
      direction: t.direction,
      title:
        `${t.direction} ${t.currency} ${t.amountBase?.toString?.() ?? ''}`.trim(),
      meta: {
        description: t.description ?? null,
        sourceType: t.sourceType,
        sourceId: t.sourceId ?? null,
      },
      links: linksByTx.get(t.id) ?? [],
      primary: Array.from(
        new Map(
          (primaryByTx.get(t.id) ?? []).map((x) => [`${x.type}:${x.id}`, x]),
        ).values(),
      ),
    }));

    return {
      scope: { legalEntityId },
      context: { kind: 'CF', from: from.toISOString(), to: to.toISOString() },
      items,
      page: { limit: params.limit, offset: params.offset, total },
    };
  }

  async explainEntity(params: {
    type: string;
    id: string;
  }): Promise<ExplainPayload> {
    const type = (params.type ?? '').trim();
    const id = (params.id ?? '').trim();
    if (!type || !id) throw new BadRequestException('type and id are required');

    if (type === 'PaymentExecution') {
      const pe = await this.prisma.paymentExecution.findUnique({
        where: { id },
      });
      if (!pe) throw new NotFoundException('PaymentExecution not found');
      const moneyTx = await this.prisma.moneyTransaction.findFirst({
        where: {
          sourceType: MoneyTransactionSourceType.PAYMENT_EXECUTION,
          sourceId: pe.id,
        } as any,
      });
      const links = moneyTx
        ? await this.prisma.cashAccountingLink.findMany({
            where: { moneyTransactionId: moneyTx.id } as any,
            select: {
              role: true,
              moneyTransactionId: true,
              accountingEntryId: true,
            },
          })
        : [];
      const entryIds = links.map((l) => l.accountingEntryId);
      const entries = entryIds.length
        ? await this.prisma.accountingEntry.findMany({
            where: { id: { in: entryIds } } as any,
          })
        : [];

      const legalEntityId = pe.legalEntityId;

      // Build items
      const items: ExplainItem[] = [];
      items.push({
        kind: 'DOC',
        id: pe.id,
        occurredAt: pe.executedAt.toISOString(),
        amountBase:
          (pe.amountBase as any)?.toNumber?.() ?? Number(pe.amountBase ?? 0),
        currency: pe.currency,
        title: `PaymentExecution ${pe.id}`,
        links: [],
        primary: [
          {
            type: 'PaymentExecution',
            id: pe.id,
            display: { title: `PaymentExecution ${pe.id}` },
          },
        ],
      });

      if (moneyTx) {
        items.push({
          kind: 'MONEY_TRANSACTION',
          id: moneyTx.id,
          occurredAt: moneyTx.occurredAt.toISOString(),
          amountBase:
            (moneyTx.amountBase as any)?.toNumber?.() ??
            Number(moneyTx.amountBase ?? 0),
          currency: moneyTx.currency,
          direction: moneyTx.direction,
          title: `MoneyTx ${moneyTx.direction}`,
          links: links.map((l) => ({
            type: 'CASH',
            role: String(l.role),
            from: { type: 'MoneyTransaction', id: l.moneyTransactionId },
            to: { type: 'AccountingEntry', id: l.accountingEntryId },
          })),
          primary: [
            {
              type: 'MoneyTransaction',
              id: moneyTx.id,
              display: { title: `MoneyTx ${moneyTx.id}` },
            },
          ],
        });
      }

      for (const e of entries as any[]) {
        items.push({
          kind: 'ACCOUNTING_ENTRY_LINE',
          id: e.id,
          occurredAt: e.postingDate.toISOString(),
          amountBase: e.amountBase?.toNumber?.() ?? Number(e.amountBase ?? 0),
          currency: e.currency,
          debitAccountId: e.debitAccount,
          creditAccountId: e.creditAccount,
          docType: e.docType,
          docId: e.docId,
          title: `${e.docType} ${e.docId}`,
          links: [],
          primary: [],
        });
      }

      return {
        scope: { legalEntityId },
        context: { kind: 'ENTITY' },
        items,
      };
    }

    // Minimal: unsupported types for now (extend per DoD as needed)
    throw new BadRequestException(`Unsupported type ${type}`);
  }
}
