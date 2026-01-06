import { Test } from '@nestjs/testing';
import { SalesDocumentsService } from './sales-documents.service';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryService } from '../accounting-entry/accounting-entry.service';
import { PostingRunsService } from '../posting-runs/posting-runs.service';
import { AccountingValidationService } from '../accounting-validation.service';
import { InventoryOrchestratorService } from '../../inventory/inventory-orchestrator.service';
import { InventoryAccountingLinkWriterService } from '../../inventory/inventory-accounting-link-writer.service';
import { AccountingDocType, PostingRunStatus, Prisma, SalesDocumentStatus } from '@prisma/client';
import { FinanceAccountMappingService } from '../account-mapping/finance-account-mapping.service';

describe('SalesDocumentsService (TZ 10 sales posting MVP)', () => {
  it('posts revenue + cogs + links movements to COGS entry', async () => {
    const tx: any = {
      accountingEntry: {
        count: jest.fn().mockResolvedValue(0),
      },
      salesDocument: {
        update: jest.fn().mockResolvedValue({ id: 'sd-1', status: 'POSTED' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'sd-1',
          status: SalesDocumentStatus.IMPORTED,
          brandId: 'b1',
          countryId: 'c1',
          marketplaceId: null,
          warehouseId: 'wh-1',
          periodFrom: new Date('2025-01-01'),
          periodTo: new Date('2025-01-02'),
          totalRevenue: new Prisma.Decimal(600),
          totalRefunds: new Prisma.Decimal(0),
          SalesDocumentLine: [
            {
              id: 'line-1',
              itemId: 'item-1',
              warehouseId: 'wh-1',
              date: new Date('2025-01-02'),
              quantity: new Prisma.Decimal(2),
              revenue: new Prisma.Decimal(600),
              commission: new Prisma.Decimal(0),
              refunds: new Prisma.Decimal(0),
              meta: {},
            },
          ],
          Marketplace: null,
        }),
      },
      stockMovement: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'mv-1',
            quantity: new Prisma.Decimal(-2),
            meta: { lineCostBase: '200' },
            StockBatche: { unitCostBase: new Prisma.Decimal(100) },
          },
        ]),
      },
    };

    const prismaMock: any = {
      $transaction: jest.fn(async (fn: any) => fn(tx)),
      salesDocument: tx.salesDocument,
      brandCountry: { findUnique: jest.fn().mockResolvedValue({ legalEntityId: 'le-1' }) },
    };
    const accountingMock: any = {
      createEntry: jest.fn()
        // revenue
        .mockResolvedValueOnce({ id: 'e-rev' })
        // cogs
        .mockResolvedValueOnce({ id: 'e-cogs' }),
    };
    const postingRunsMock: any = {
      getOrCreatePostedRun: jest.fn().mockResolvedValue({ id: 'run-1', status: PostingRunStatus.POSTED }),
      hasEntries: jest.fn().mockResolvedValue(false),
    };
    const validationMock: any = {
      maybeValidateDocumentBalanceOnPost: jest.fn().mockResolvedValue(undefined),
    };
    const inventoryOrchestratorMock: any = {
      recordOutcome: jest.fn().mockResolvedValue({
        transactionId: 'invtx-1',
        movementIds: ['mv-1'],
        totalCostBase: new Prisma.Decimal(200),
      }),
    };
    const linksWriterMock: any = {
      link: jest.fn().mockResolvedValue(undefined),
    };
    const accountMappingMock: any = {
      getSalesPostingAccounts: jest.fn().mockResolvedValue({
        arAccount: '62.01',
        revenueAccount: '90.01',
        contraRevenueAccount: '90.01',
        cogsAccount: '90.02',
        inventoryAssetAccount: '10.02',
        marketplaceFeeExpenseAccount: '90.02.1',
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SalesDocumentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AccountingEntryService, useValue: accountingMock },
        { provide: PostingRunsService, useValue: postingRunsMock },
        { provide: AccountingValidationService, useValue: validationMock },
        { provide: InventoryOrchestratorService, useValue: inventoryOrchestratorMock },
        { provide: InventoryAccountingLinkWriterService, useValue: linksWriterMock },
        { provide: FinanceAccountMappingService, useValue: accountMappingMock },
      ],
    }).compile();

    const svc = moduleRef.get(SalesDocumentsService);
    const res = await svc.postSalesDocument('sd-1');

    expect(postingRunsMock.getOrCreatePostedRun).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: 'le-1',
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: 'sd-1',
      }),
    );
    expect(inventoryOrchestratorMock.recordOutcome).toHaveBeenCalled();
    expect(accountingMock.createEntry).toHaveBeenCalled();
    // 2 links per movement (COGS + INVENTORY)
    expect(linksWriterMock.link).toHaveBeenCalledTimes(2);
    expect(linksWriterMock.link).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        movementIds: ['mv-1'],
        entryIds: ['e-cogs'],
        movementAmountBase: { 'mv-1': '200' },
        postingRunId: 'run-1',
      }),
    );
    expect(linksWriterMock.link).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        movementIds: ['mv-1'],
        entryIds: ['e-cogs'],
        movementAmountBase: { 'mv-1': '200' },
        postingRunId: 'run-1',
      }),
    );
    expect(res.posted).toBe(true);
    expect(res.cogsEntryId).toBe('e-cogs');
  });

  it('creates SALE_RETURN: restocks inventory at historical cost and posts revenue+COGS reversal with links', async () => {
    const tx: any = {
      accountingEntry: {
        count: jest.fn().mockResolvedValue(0),
      },
      salesDocument: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sd-1',
          status: SalesDocumentStatus.POSTED,
          brandId: 'b1',
          countryId: 'c1',
          marketplaceId: null,
          warehouseId: 'wh-1',
          periodFrom: new Date('2025-01-01'),
          periodTo: new Date('2025-01-02'),
          totalRevenue: new Prisma.Decimal(600),
          totalRefunds: new Prisma.Decimal(0),
          SalesDocumentLine: [
            {
              id: 'line-1',
              itemId: 'item-1',
              warehouseId: 'wh-1',
              date: new Date('2025-01-02'),
              quantity: new Prisma.Decimal(2),
              revenue: new Prisma.Decimal(600),
              commission: new Prisma.Decimal(0),
              refunds: new Prisma.Decimal(0),
              meta: {},
            },
          ],
          Marketplace: null,
        }),
      },
      // Original SALE OUT movements (historical cost source)
      stockMovement: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'out-1',
            createdAt: new Date('2025-01-02'),
            itemId: 'item-1',
            warehouseId: 'wh-1',
            quantity: new Prisma.Decimal(-2),
            meta: { salesDocumentLineId: 'line-1', lineCostBase: '200' },
            StockBatche: { unitCostBase: new Prisma.Decimal(100) },
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'in-1',
          inventoryTransactionId: 'invtx-in-1',
          batchId: 'batch-1',
        }),
      },
      salesReturnOperation: {
        findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'ret-1' }),
        create: jest.fn().mockResolvedValue({ id: 'ret-1' }),
        update: jest.fn().mockResolvedValue({ id: 'ret-1', status: 'POSTED' }),
      },
      salesReturnOperationLine: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantity: null } }),
        create: jest.fn().mockResolvedValue({ id: 'rol-1' }),
      },
    };

    const prismaMock: any = {
      $transaction: jest.fn(async (fn: any) => fn(tx)),
      brandCountry: { findUnique: jest.fn().mockResolvedValue({ legalEntityId: 'le-1' }) },
    };
    const accountingMock: any = {
      // revenue reversal + inventory entry + cogs entry
      createEntry: jest
        .fn()
        .mockResolvedValueOnce({ id: 'e-rev-ret' })
        .mockResolvedValueOnce({ id: 'e-inv-ret' })
        .mockResolvedValueOnce({ id: 'e-cogs-ret' }),
    };
    const postingRunsMock: any = {
      getOrCreatePostedRun: jest.fn().mockResolvedValue({ id: 'run-ret-1', status: PostingRunStatus.POSTED }),
    };
    const validationMock: any = {
      validatePostingRunBalance: jest.fn().mockResolvedValue(undefined),
    };
    const inventoryOrchestratorMock: any = {
      recordIncome: jest.fn().mockResolvedValue({
        transactionId: 'invtx-in-1',
        movementId: 'in-1',
      }),
    };
    const linksWriterMock: any = {
      link: jest.fn().mockResolvedValue(undefined),
    };
    const accountMappingMock: any = {
      getSalesPostingAccounts: jest.fn().mockResolvedValue({
        arAccount: '62.01',
        revenueAccount: '90.01',
        contraRevenueAccount: '90.01',
        cogsAccount: '90.02',
        inventoryAssetAccount: '10.02',
        marketplaceFeeExpenseAccount: '90.02.1',
      }),
      getSalesReturnPostingAccounts: jest.fn().mockResolvedValue({
        arAccount: '62.01',
        revenueAccount: '90.01',
        contraRevenueAccount: '90.01',
        cogsAccount: '90.02',
        inventoryAssetAccount: '10.02',
        marketplaceFeeExpenseAccount: '90.02.1',
        inventoryCogsClearingAccount: '57.04',
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SalesDocumentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AccountingEntryService, useValue: accountingMock },
        { provide: PostingRunsService, useValue: postingRunsMock },
        { provide: AccountingValidationService, useValue: validationMock },
        { provide: InventoryOrchestratorService, useValue: inventoryOrchestratorMock },
        { provide: InventoryAccountingLinkWriterService, useValue: linksWriterMock },
        { provide: FinanceAccountMappingService, useValue: accountMappingMock },
      ],
    }).compile();

    const svc = moduleRef.get(SalesDocumentsService);
    const res = await svc.createReturnWithRestock({
      saleId: 'sd-1',
      idempotencyKey: 'e2e-idem-return-1',
      occurredAt: new Date('2025-01-03'),
      reason: 'test',
      lines: [{ saleLineId: 'line-1', quantity: '1', refundAmountBase: '300' }],
    } as any);

    // Guardrail (TZ CI.2): revenue reversal is always posted in base currency (no double FX).
    const revArgs = accountingMock.createEntry.mock.calls[0][0];
    expect(revArgs.docType).toBe(AccountingDocType.SALE_RETURN);
    expect(revArgs.debitAccount).toBe('90.01');
    expect(revArgs.creditAccount).toBe('62.01');
    expect(revArgs.currency).toBe('USD');
    expect(new Prisma.Decimal(revArgs.amount).toString()).toBe('300');

    expect(postingRunsMock.getOrCreatePostedRun).toHaveBeenCalledWith(
      expect.objectContaining({
        legalEntityId: 'le-1',
      }),
    );
    expect(inventoryOrchestratorMock.recordIncome).toHaveBeenCalledWith(
      expect.objectContaining({
        docType: expect.any(String),
        docId: 'ret-1',
      }),
      tx,
    );
    // 2 links per movement: linkType=COGS → cogs entry; linkType=INVENTORY → inventory entry
    expect(linksWriterMock.link).toHaveBeenCalledTimes(2);
    expect(linksWriterMock.link).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        entryIds: ['e-cogs-ret'],
        linkType: 'COGS',
      }),
    );
    expect(linksWriterMock.link).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        entryIds: ['e-inv-ret'],
        linkType: 'INVENTORY',
      }),
    );
    // COGS reversal amount should be 100 for qty=1 out of cost=200 qty=2
    const inventoryArgs = accountingMock.createEntry.mock.calls[1][0];
    expect(inventoryArgs.debitAccount).toBe('10.02');
    expect(inventoryArgs.creditAccount).toBe('57.04');
    expect(new Prisma.Decimal(inventoryArgs.amount).toString()).toBe('100');
    const cogsArgs = accountingMock.createEntry.mock.calls[2][0];
    expect(cogsArgs.debitAccount).toBe('57.04');
    expect(cogsArgs.creditAccount).toBe('90.02');
    expect(new Prisma.Decimal(cogsArgs.amount).toString()).toBe('100');
    expect(res).toBeTruthy();
  });
});

