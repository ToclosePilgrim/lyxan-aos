import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, AccountingDocType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CurrencyRateService } from '../currency-rates/currency-rate.service';
import { ACCOUNTING_ACCOUNTS } from '../accounting-accounts.config';
import { resolveAccountingEntryScope } from './accounting-entry-scope';

@Injectable()
export class AccountingEntryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyRates: CurrencyRateService,
  ) {}

  async createEntry(input: {
    docType: AccountingDocType;
    docId: string;
    sourceDocType?: AccountingDocType;
    sourceDocId?: string;
    legalEntityId?: string;
    // Scope (C.3)
    countryId?: string;
    brandId?: string;
    marketplaceId?: string | null;
    warehouseId?: string | null;
    lineNumber: number;
    postingDate: Date;
    debitAccount: string;
    creditAccount: string;
    amount: Prisma.Decimal | number | string;
    currency: string;
    description?: string;
    source?: string;
    metadata?: Record<string, unknown>;
    postingRunId?: string | null;
    tx?: Prisma.TransactionClient;
  }) {
    const client = input.tx ?? this.prisma;

    // Double-entry invariants (B.3)
    if (!input.debitAccount || !input.creditAccount) {
      throw new Error(
        'Accounting entry must have both debitAccount and creditAccount',
      );
    }
    if (input.debitAccount === input.creditAccount) {
      throw new Error(
        'Accounting entry debitAccount must differ from creditAccount',
      );
    }
    const amount = new Prisma.Decimal(input.amount);
    if (amount.lte(0)) {
      throw new Error('Accounting entry amount must be > 0');
    }
    if (!input.currency) {
      throw new Error('Accounting entry currency is required');
    }

    // Line-level idempotency (TZ 0.4): if metadata.docLineId is set, reuse existing line
    // Additionally (TZ 1.1): if existing line is missing legalEntityId, we patch it if we can resolve it.
    const docLineId = (input.metadata as any)?.docLineId as string | undefined;
    const existing = docLineId
      ? await client.accountingEntry.findFirst({
          where: {
            docType: input.docType,
            docId: input.docId,
            metadata: { path: ['docLineId'], equals: docLineId } as any,
          },
        })
      : null;

    const knownAccounts = new Set<string>(Object.values(ACCOUNTING_ACCOUNTS));
    if (!knownAccounts.has(input.debitAccount)) {
      throw new Error(`Unknown debit account code: ${input.debitAccount}`);
    }
    if (!knownAccounts.has(input.creditAccount)) {
      throw new Error(`Unknown credit account code: ${input.creditAccount}`);
    }

    const amountBase = await this.currencyRates.convertToBase({
      amount,
      currency: input.currency,
      date: input.postingDate,
    });

    await this.validateDocumentLinking(client, input.docType, input.docId);
    if (input.sourceDocType && input.sourceDocId) {
      await this.validateDocumentLinking(
        client,
        input.sourceDocType,
        input.sourceDocId,
      );
    }

    const scope = await resolveAccountingEntryScope({
      client,
      docType: input.docType,
      docId: input.docId,
      sourceDocType: input.sourceDocType ?? null,
      sourceDocId: input.sourceDocId ?? null,
      legalEntityId: input.legalEntityId,
      countryId: input.countryId,
      brandId: input.brandId,
      marketplaceId: input.marketplaceId ?? null,
      warehouseId: input.warehouseId ?? null,
    });

    const legalEntityId = input.legalEntityId ?? scope.legalEntityId;
    if (!legalEntityId) {
      // should never happen: resolver must enforce it
      throw new BadRequestException(
        'No LegalEntity configured for brand+country; configure BrandCountry.legalEntityId',
      );
    }

    if (existing) {
      const needsLegalEntity = !(existing as any).legalEntityId;
      const needsPostingRunId =
        !!input.postingRunId && !(existing as any).postingRunId;
      if (!needsLegalEntity && !needsPostingRunId) return existing;

      // Patch legacy row to satisfy TZ 1.1 contract + ensure postingRunId is attached when provided.
      return client.accountingEntry.update({
        where: { id: existing.id },
        data: {
          ...(needsLegalEntity ? { legalEntityId } : {}),
          ...(needsPostingRunId ? { postingRunId: input.postingRunId } : {}),
        } as any,
      });
    }

    return client.accountingEntry.create({
      data: {
        docType: input.docType,
        docId: input.docId,
        sourceDocType: input.sourceDocType ?? input.docType,
        sourceDocId: input.sourceDocId ?? input.docId,
        lineNumber: input.lineNumber,
        postingDate: input.postingDate,
        debitAccount: input.debitAccount,
        creditAccount: input.creditAccount,
        amount,
        currency: input.currency,
        amountBase,
        description: input.description ?? null,
        source: input.source ?? 'auto',
        metadata: input.metadata
          ? (input.metadata as unknown as Prisma.InputJsonValue)
          : undefined,
        postingRunId: input.postingRunId ?? undefined,
        countryId: scope.countryId,
        brandId: scope.brandId,
        legalEntityId,
        marketplaceId: scope.marketplaceId ?? null,
        warehouseId: scope.warehouseId ?? null,
      },
    });
  }

  // NOTE: test seed endpoint is implemented in DevTools TestSeedModule and is never wired in AppModule.

  private async validateDocumentLinking(
    client: Prisma.TransactionClient | PrismaService,
    docType: AccountingDocType,
    docId: string,
  ) {
    const repoMap: Record<AccountingDocType, (id: string) => Promise<unknown>> =
      {
        [AccountingDocType.ACQUIRING_EVENT]: (id) =>
          (client as any).acquiringEvent?.findUnique
            ? (client as any).acquiringEvent.findUnique({ where: { id } })
            : Promise.resolve(true),
        [AccountingDocType.SALES_DOCUMENT]: (id) =>
          client.salesDocument.findUnique({ where: { id } }),
        [AccountingDocType.SUPPLY]: (id) =>
          client.scmSupply.findUnique({ where: { id } }),
        [AccountingDocType.INVENTORY_ADJUSTMENT]: (id) =>
          client.inventoryAdjustment.findUnique({ where: { id } }),
        [AccountingDocType.PAYMENT]: async () => true, // payment may point to financialDocument or external; skip
        [AccountingDocType.FINANCIAL_DOCUMENT]: (id) =>
          client.financialDocument.findUnique({ where: { id } }),
        [AccountingDocType.FINANCIAL_DOCUMENT_ACCRUAL]: (id) =>
          client.financialDocument.findUnique({ where: { id } }),
        [AccountingDocType.FINANCIAL_DOCUMENT_RECOGNITION]: (id) =>
          client.financialDocument.findUnique({ where: { id } }),
        [AccountingDocType.STOCK_TRANSFER]: (id) =>
          client.scmTransfer.findUnique({ where: { id } }),
        [AccountingDocType.STOCK_ADJUSTMENT]: (id) =>
          client.inventoryAdjustment.findUnique({ where: { id } }),
        [AccountingDocType.SUPPLY_RECEIPT]: (id) =>
          client.scmSupplyReceipt.findUnique({ where: { id } }),
        [AccountingDocType.PRODUCTION_COMPLETION]: async () => true,
        [AccountingDocType.PRODUCTION_CONSUMPTION]: async () => true,
        [AccountingDocType.INTERNAL_TRANSFER]: async () => true,
        [AccountingDocType.MARKETPLACE_PAYOUT_TRANSFER]: async () => true,
        [AccountingDocType.STATEMENT_LINE_FEE]: async () => true,
        [AccountingDocType.PAYMENT_EXECUTION]: async () => true,
        [AccountingDocType.TEST_SEED]: async () => true,
        [AccountingDocType.OTHER]: async () => true,
      };

    const checker = repoMap[docType];
    if (!checker) return;
    const exists = await checker(docId);
    if (!exists) {
      throw new Error(
        `Linked document not found for ${docType} with id ${docId}`,
      );
    }
  }

  async listByDocument(params: { docType: AccountingDocType; docId: string }) {
    return this.prisma.accountingEntry.findMany({
      where: {
        docType: params.docType,
        docId: params.docId,
      },
      orderBy: { lineNumber: 'asc' },
    });
  }

  async list(filter: {
    fromDate?: Date;
    toDate?: Date;
    debitAccount?: string;
    creditAccount?: string;
    docType?: AccountingDocType;
    limit?: number;
  }) {
    return this.prisma.accountingEntry.findMany({
      where: {
        postingDate: {
          gte: filter.fromDate,
          lte: filter.toDate,
        },
        debitAccount: filter.debitAccount,
        creditAccount: filter.creditAccount,
        docType: filter.docType,
      },
      orderBy: { postingDate: 'desc' },
      take: filter.limit ?? 500,
    });
  }
}
