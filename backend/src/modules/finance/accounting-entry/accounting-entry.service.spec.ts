import { Test } from '@nestjs/testing';
import { AccountingEntryService } from './accounting-entry.service';
import { PrismaService } from '../../../database/prisma.service';
import { CurrencyRateService } from '../currency-rates/currency-rate.service';
import { AccountingDocType, Prisma } from '@prisma/client';

describe('AccountingEntryService (scope C.3)', () => {
  it('throws if scope cannot be derived', async () => {
    const prismaMock = {
      accountingEntry: { create: jest.fn() },
      salesDocument: { findUnique: jest.fn().mockResolvedValue(null) },
      scmSupply: { findUnique: jest.fn().mockResolvedValue(null) },
      scmSupplyReceipt: { findUnique: jest.fn().mockResolvedValue(null) },
      inventoryAdjustment: { findUnique: jest.fn().mockResolvedValue(null) },
      product: { findUnique: jest.fn().mockResolvedValue(null) },
      scmProduct: { findUnique: jest.fn().mockResolvedValue(null) },
      financialDocument: { findUnique: jest.fn().mockResolvedValue(null) },
      productionOrder: { findUnique: jest.fn().mockResolvedValue(null) },
      financePayment: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;

    const ratesMock = {
      convertToBase: jest.fn(
        async ({ amount }: { amount: Prisma.Decimal }) => amount,
      ),
    } as unknown as CurrencyRateService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountingEntryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CurrencyRateService, useValue: ratesMock },
      ],
    }).compile();

    const service = moduleRef.get(AccountingEntryService);

    await expect(
      service.createEntry({
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: 'missing',
        lineNumber: 1,
        postingDate: new Date(),
        debitAccount: '62.01',
        creditAccount: '90.01',
        amount: 100,
        currency: 'RUB',
      }),
    ).rejects.toBeTruthy();
  });

  it('uses provided countryId/brandId when present', async () => {
    const prismaMock = {
      accountingEntry: { create: jest.fn().mockResolvedValue({ id: 'e1' }) },
    } as unknown as PrismaService;

    const ratesMock = {
      convertToBase: jest.fn(
        async ({ amount }: { amount: Prisma.Decimal }) => amount,
      ),
    } as unknown as CurrencyRateService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountingEntryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CurrencyRateService, useValue: ratesMock },
      ],
    }).compile();

    const service = moduleRef.get(AccountingEntryService);

    await service.createEntry({
      docType: AccountingDocType.OTHER,
      docId: 'd1',
      sourceDocType: AccountingDocType.OTHER,
      sourceDocId: 'd1',
      countryId: 'c1',
      brandId: 'b1',
      marketplaceId: null,
      warehouseId: null,
      lineNumber: 1,
      postingDate: new Date(),
      debitAccount: '62.01',
      creditAccount: '90.01',
      amount: 100,
      currency: 'RUB',
      description: 'x',
    });

    expect((prismaMock as any).accountingEntry.create).toHaveBeenCalled();
    const args = (prismaMock as any).accountingEntry.create.mock.calls[0][0];
    expect(args.data.countryId).toBe('c1');
    expect(args.data.brandId).toBe('b1');
  });
});
