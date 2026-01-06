import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { FifoInventoryService } from './fifo.service';
import { PrismaService } from '../../database/prisma.service';
import { CurrencyRateService } from '../finance/currency-rates/currency-rate.service';
import {
  InventoryBatchSourceType,
  InventoryDocumentType,
  InventoryMovementType,
} from './inventory.enums';

describe('FifoInventoryService - StockMovement Idempotency', () => {
  let service: FifoInventoryService;
  let prismaService: jest.Mocked<PrismaService>;
  let currencyRateService: jest.Mocked<CurrencyRateService>;
  let mockTx: jest.Mocked<Prisma.TransactionClient>;

  beforeEach(async () => {
    const mockPrisma = {
      stockBatch: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      stockMovement: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const mockCurrencyRates = {
      convertToBase: jest.fn().mockResolvedValue(new Prisma.Decimal(1)),
      getRateToBase: jest.fn().mockResolvedValue(new Prisma.Decimal(1)),
      getBaseCurrency: jest.fn().mockResolvedValue('USD'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FifoInventoryService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: CurrencyRateService,
          useValue: mockCurrencyRates,
        },
      ],
    }).compile();

    service = module.get<FifoInventoryService>(FifoInventoryService);
    prismaService = module.get(PrismaService);
    currencyRateService = module.get(CurrencyRateService);

    mockTx = {
      stockBatch: prismaService.stockBatch as any,
      stockMovement: prismaService.stockMovement as any,
    } as any;
  });

  describe('recordIncome - idempotency', () => {
    it('should return existing movement when idempotencyKey matches', async () => {
      const idempotencyKey = 'invm:v1:SUPPLY_RECEIPT:receipt-123:IN:item-1:wh-1';
      const existingMovement = {
        id: 'movement-existing',
        idempotencyKey,
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: new Prisma.Decimal(10),
      };

      prismaService.stockMovement.findUnique.mockResolvedValueOnce(
        existingMovement as any,
      );

      const result = await service.recordIncome({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 10,
        unitCost: 10,
        currency: 'RUB',
        docType: InventoryDocumentType.SUPPLY_RECEIPT,
        docId: 'receipt-123',
        batchSourceType: InventoryBatchSourceType.SUPPLY,
        idempotencyKey,
        tx: mockTx as any,
      });

      expect(result.id).toBe('movement-existing');
      expect(prismaService.stockBatch.create).not.toHaveBeenCalled();
      expect(prismaService.stockMovement.create).not.toHaveBeenCalled();
    });

    it('should create new movement when idempotencyKey does not exist', async () => {
      const idempotencyKey = 'invm:v1:SUPPLY_RECEIPT:receipt-123:IN:item-1:wh-1';
      const batch = {
        id: 'batch-new',
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: new Prisma.Decimal(10),
        costPerUnit: new Prisma.Decimal(10),
      };
      const movement = {
        id: 'movement-new',
        idempotencyKey,
        batchId: 'batch-new',
      };

      prismaService.stockMovement.findUnique.mockResolvedValueOnce(null);
      prismaService.stockBatch.create.mockResolvedValueOnce(batch as any);
      prismaService.stockMovement.create.mockResolvedValueOnce(movement as any);
      currencyRateService.convertToBase.mockResolvedValueOnce(
        new Prisma.Decimal(1),
      );

      const result = await service.recordIncome({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 10,
        unitCost: 10,
        currency: 'RUB',
        docType: InventoryDocumentType.SUPPLY_RECEIPT,
        docId: 'receipt-123',
        batchSourceType: InventoryBatchSourceType.SUPPLY,
        idempotencyKey,
        tx: mockTx as any,
      });

      expect(result.id).toBe('movement-new');
      expect(prismaService.stockBatch.create).toHaveBeenCalled();
      expect(prismaService.stockMovement.create).toHaveBeenCalled();
    });
  });

  describe('recordOutcome - idempotency', () => {
    it('should not duplicate movements when called twice with same idempotencyKey', async () => {
      const batches = [
        {
          id: 'batch-1',
          itemId: 'item-1',
          warehouseId: 'wh-1',
          quantity: new Prisma.Decimal(10),
          costPerUnit: new Prisma.Decimal(10),
          currency: 'RUB',
          unitCostBase: new Prisma.Decimal(10),
        },
        {
          id: 'batch-2',
          itemId: 'item-1',
          warehouseId: 'wh-1',
          quantity: new Prisma.Decimal(5),
          costPerUnit: new Prisma.Decimal(10),
          currency: 'RUB',
          unitCostBase: new Prisma.Decimal(10),
        },
      ];

      const existingMovements = [
        {
          id: 'mov-1',
          idempotencyKey: 'invm:v1:PRODUCTION_CONSUMPTION:cons-123:OUT:item-1:wh-1:batch-1:part0',
          batchId: 'batch-1',
          quantity: new Prisma.Decimal(-10),
        },
        {
          id: 'mov-2',
          idempotencyKey: 'invm:v1:PRODUCTION_CONSUMPTION:cons-123:OUT:item-1:wh-1:batch-2:part1',
          batchId: 'batch-2',
          quantity: new Prisma.Decimal(-5),
        },
      ];

      prismaService.stockBatch.findMany.mockResolvedValueOnce(batches as any);
      
      // First movement already exists
      prismaService.stockMovement.findUnique
        .mockResolvedValueOnce(existingMovements[0] as any) // First check: exists
        .mockResolvedValueOnce(existingMovements[1] as any); // Second check: exists

      prismaService.stockBatch.update.mockResolvedValue({} as any);

      const buildIdempotencyKey = (mv: any, idx: number, batchId: string | null) =>
        `invm:v1:PRODUCTION_CONSUMPTION:cons-123:OUT:item-1:wh-1:${batchId}:part${idx}`;

      const result = await service.recordOutcome({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 15,
        docType: InventoryDocumentType.PRODUCTION_CONSUMPTION,
        docId: 'cons-123',
        buildIdempotencyKey,
        tx: mockTx as any,
      });

      // Should return existing movements, not create new ones
      expect(result.movements.length).toBe(2);
      expect(result.movements[0].id).toBe('mov-1');
      expect(result.movements[1].id).toBe('mov-2');
      expect(prismaService.stockMovement.create).not.toHaveBeenCalled();
    });

    it('should create new movements when idempotencyKey does not exist', async () => {
      const batches = [
        {
          id: 'batch-1',
          itemId: 'item-1',
          warehouseId: 'wh-1',
          quantity: new Prisma.Decimal(10),
          costPerUnit: new Prisma.Decimal(10),
          currency: 'RUB',
          unitCostBase: new Prisma.Decimal(10),
        },
      ];

      const movements = [
        {
          id: 'mov-1',
          idempotencyKey: 'invm:v1:PRODUCTION_CONSUMPTION:cons-123:OUT:item-1:wh-1:batch-1:part0',
          batchId: 'batch-1',
          quantity: new Prisma.Decimal(-10),
          costPerUnit: new Prisma.Decimal(10),
          currency: 'RUB',
        },
      ];

      prismaService.stockBatch.findMany.mockResolvedValueOnce(batches as any);
      prismaService.stockMovement.findUnique.mockResolvedValueOnce(null); // Not found
      prismaService.stockBatch.update.mockResolvedValue({} as any);
      prismaService.stockMovement.create.mockResolvedValueOnce(movements[0] as any);

      const buildIdempotencyKey = (mv: any, idx: number, batchId: string | null) =>
        `invm:v1:PRODUCTION_CONSUMPTION:cons-123:OUT:item-1:wh-1:${batchId}:part${idx}`;

      const result = await service.recordOutcome({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 10,
        docType: InventoryDocumentType.PRODUCTION_CONSUMPTION,
        docId: 'cons-123',
        buildIdempotencyKey,
        tx: mockTx as any,
      });

      expect(result.movements.length).toBe(1);
      expect(result.movements[0].id).toBe('mov-1');
      expect(prismaService.stockMovement.create).toHaveBeenCalledTimes(1);
    });

    it('should compute totalCostBase correctly for mixed-currency batches (no currency mixing)', async () => {
      // base currency is USD (mocked), but batches are in USD and EUR
      const batches = [
        {
          id: 'batch-usd',
          itemId: 'item-1',
          warehouseId: 'wh-1',
          quantity: new Prisma.Decimal(1),
          costPerUnit: new Prisma.Decimal(100),
          currency: 'USD',
          unitCostBase: new Prisma.Decimal(100),
        },
        {
          id: 'batch-eur',
          itemId: 'item-1',
          warehouseId: 'wh-1',
          quantity: new Prisma.Decimal(1),
          costPerUnit: new Prisma.Decimal(100),
          currency: 'EUR',
          unitCostBase: new Prisma.Decimal(120),
        },
      ];

      prismaService.stockBatch.findMany.mockResolvedValueOnce(batches as any);
      prismaService.stockMovement.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prismaService.stockBatch.update.mockResolvedValue({} as any);

      let created = 0;
      prismaService.stockMovement.create.mockImplementation(async ({ data }: any) => {
        created += 1;
        return { id: `mov-${created}`, ...data } as any;
      });

      const result = await service.recordOutcome({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: 2,
        docType: InventoryDocumentType.PRODUCTION_CONSUMPTION,
        docId: 'cons-mixed',
        buildIdempotencyKey: (_mv: any, idx: number, batchId: string | null) =>
          `invm:v1:PRODUCTION_CONSUMPTION:cons-mixed:OUT:item-1:wh-1:${batchId}:part${idx}`,
        tx: mockTx as any,
      });

      expect(result.baseCurrency).toBe('USD');
      expect(result.currency).toBe('USD');
      expect(result.totalCostBase.toString()).toBe('220');
      expect(result.totalCost.toString()).toBe('220');

      const metas = result.movements.map((m: any) => m.meta);
      expect(metas[0].lineCostBase).toBe('100');
      expect(metas[1].lineCostBase).toBe('120');
    });
  });
});



