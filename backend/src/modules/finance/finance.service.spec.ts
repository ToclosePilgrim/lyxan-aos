import { Test } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
describe('FinanceService.getPnl (C.3 strict scope)', () => {
  it('throws if scope is missing', async () => {
    const prismaMock = {
      accountingEntry: { findMany: jest.fn() },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const svc = moduleRef.get(FinanceService);
    await expect(svc.getPnl({} as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('filters entries by countryId/brandId (+marketplaceId when provided)', async () => {
    const prismaMock = {
      accountingEntry: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    const svc = moduleRef.get(FinanceService);

    await svc.getPnl({
      countryId: 'c1',
      brandId: 'b1',
      marketplaceId: 'm1',
      dateFrom: '2025-01-01',
      dateTo: '2025-01-31',
    } as any);

    const args = (prismaMock as any).accountingEntry.findMany.mock.calls[0][0];
    expect(args.where.countryId).toBe('c1');
    expect(args.where.brandId).toBe('b1');
    expect(args.where.marketplaceId).toBe('m1');
    expect(args.where.postingDate.gte).toBeInstanceOf(Date);
    expect(args.where.postingDate.lte).toBeInstanceOf(Date);
  });
});
