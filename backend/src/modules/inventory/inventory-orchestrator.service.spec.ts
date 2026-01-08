import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { InventoryOrchestratorService } from './inventory-orchestrator.service';
import { FifoInventoryService } from './fifo.service';
import { InventoryService } from './inventory.service';
import { InventoryEventsService } from './inventory-events.service';
import {
  InventoryBatchSourceType,
  InventoryDocumentType,
  InventoryMovementType,
} from './inventory.enums';
import { AccountingDocType, InventoryDirection } from '@prisma/client';

describe('InventoryOrchestratorService - Idempotency', () => {
  let service: InventoryOrchestratorService;
  let fifoService: jest.Mocked<FifoInventoryService>;
  let eventsService: jest.Mocked<InventoryEventsService>;
  let mockTx: jest.Mocked<Prisma.TransactionClient>;

  beforeEach(async () => {
    const mockFifo = {
      recordIncome: jest.fn(),
      recordOutcome: jest.fn(),
    };

    const mockInventory = {
      // InventoryOrchestrator no longer delegates InventoryBalance writes to InventoryService.
    };

    const mockEvents = {
      emitStockChanged: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryOrchestratorService,
        {
          provide: FifoInventoryService,
          useValue: mockFifo,
        },
        {
          provide: InventoryService,
          useValue: mockInventory,
        },
        {
          provide: InventoryEventsService,
          useValue: mockEvents,
        },
      ],
    }).compile();

    service = module.get<InventoryOrchestratorService>(
      InventoryOrchestratorService,
    );
    fifoService = module.get(FifoInventoryService);
    eventsService = module.get(InventoryEventsService);

    // Mock transaction client
    mockTx = {
      inventoryTransaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      stockMovement: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      stockBatch: {
        findMany: jest.fn(),
      },
      inventoryBalance: {
        upsert: jest.fn(),
      },
    } as any;
  });

  describe('recordIncome - idempotency', () => {
    it('should return existing transaction when idempotencyKey matches', async () => {
      const idempotencyKey = 'invtx:v1:SUPPLY_RECEIPT:receipt-123:IN';
      const existingTxn = {
        id: 'txn-existing',
        idempotencyKey,
        stock_movements_stock_movements_inventoryTransactionIdToinventory_transactions: [
          { id: 'movement-existing' },
        ],
      };

      mockTx.inventoryTransaction.findUnique.mockResolvedValueOnce(
        existingTxn as any,
      );

      const result = await service.recordIncome(
        {
          warehouseId: 'wh-1',
          itemId: 'item-1',
          quantity: 10,
          docType: InventoryDocumentType.SUPPLY_RECEIPT,
          docId: 'receipt-123',
          movementType: InventoryMovementType.INCOME,
          meta: {},
        },
        mockTx as any,
      );

      expect(result.transactionId).toBe('txn-existing');
      expect(result.movementId).toBe('movement-existing');
      expect(fifoService.recordIncome).not.toHaveBeenCalled();
      expect(mockTx.inventoryTransaction.create).not.toHaveBeenCalled();
    });

    it('should create new transaction when idempotencyKey does not exist', async () => {
      const movement = {
        id: 'movement-new',
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: new Prisma.Decimal(10),
      };

      mockTx.inventoryTransaction.findUnique.mockResolvedValueOnce(null);
      fifoService.recordIncome.mockResolvedValueOnce(movement as any);
      mockTx.inventoryTransaction.create.mockResolvedValueOnce({
        id: 'txn-new',
        idempotencyKey: 'invtx:v1:SUPPLY_RECEIPT:receipt-123:IN',
      } as any);
      mockTx.stockMovement.update.mockResolvedValueOnce({} as any);
      (mockTx as any).inventoryBalance.upsert.mockResolvedValueOnce({} as any);
      eventsService.emitStockChanged.mockResolvedValueOnce(undefined);

      const result = await service.recordIncome(
        {
          warehouseId: 'wh-1',
          itemId: 'item-1',
          quantity: 10,
          docType: InventoryDocumentType.SUPPLY_RECEIPT,
          docId: 'receipt-123',
          movementType: InventoryMovementType.INCOME,
          meta: {},
        },
        mockTx as any,
      );

      expect(result.transactionId).toBe('txn-new');
      expect(result.movementId).toBe('movement-new');
      expect(fifoService.recordIncome).toHaveBeenCalled();
      expect(mockTx.inventoryTransaction.create).toHaveBeenCalled();
      expect((mockTx as any).inventoryBalance.upsert).toHaveBeenCalled();
    });

    it('should handle race condition and return existing transaction', async () => {
      const existingTxn = {
        id: 'txn-existing',
        idempotencyKey: 'invtx:v1:SUPPLY_RECEIPT:receipt-123:IN',
        stock_movements_stock_movements_inventoryTransactionIdToinventory_transactions: [
          { id: 'movement-existing' },
        ],
      };

      const movement = {
        id: 'movement-new',
        itemId: 'item-1',
        warehouseId: 'wh-1',
        quantity: new Prisma.Decimal(10),
      };

      mockTx.inventoryTransaction.findUnique
        .mockResolvedValueOnce(null) // First check: not found
        .mockResolvedValueOnce(existingTxn as any); // After race: found

      fifoService.recordIncome.mockResolvedValueOnce(movement as any);
      mockTx.inventoryTransaction.create.mockRejectedValueOnce({
        code: 'P2002', // Unique constraint violation
      });
      mockTx.stockMovement.update.mockResolvedValueOnce({} as any);

      const result = await service.recordIncome(
        {
          warehouseId: 'wh-1',
          itemId: 'item-1',
          quantity: 10,
          docType: InventoryDocumentType.SUPPLY_RECEIPT,
          docId: 'receipt-123',
          movementType: InventoryMovementType.INCOME,
          meta: {},
        },
        mockTx as any,
      );

      expect(result.transactionId).toBe('txn-existing');
      expect(result.movementId).toBe('movement-existing');
    });
  });

  describe('recordOutcome - idempotency', () => {
    it('should return existing transaction and movements when idempotencyKey matches', async () => {
      const idempotencyKey = 'invtx:v1:PRODUCTION_CONSUMPTION:cons-123:OUT';
      const existingMovements = [
        {
          id: 'mov-1',
          quantity: new Prisma.Decimal(-5),
          costPerUnit: new Prisma.Decimal(10),
          currency: 'RUB',
        },
        {
          id: 'mov-2',
          quantity: new Prisma.Decimal(-5),
          costPerUnit: new Prisma.Decimal(10),
          currency: 'RUB',
        },
      ];

      const existingTxn = {
        id: 'txn-existing',
        idempotencyKey,
      };

      mockTx.inventoryTransaction.findUnique.mockResolvedValueOnce(
        existingTxn as any,
      );
      mockTx.stockMovement.findMany.mockResolvedValueOnce(existingMovements as any);

      const result = await service.recordOutcome(
        {
          warehouseId: 'wh-1',
          itemId: 'item-1',
          quantity: 10,
          docType: InventoryDocumentType.PRODUCTION_CONSUMPTION,
          docId: 'cons-123',
          movementType: InventoryMovementType.OUTCOME,
          meta: {},
        },
        mockTx as any,
      );

      expect(result.transactionId).toBe('txn-existing');
      expect(result.movementIds).toEqual(['mov-1', 'mov-2']);
      expect(fifoService.recordOutcome).not.toHaveBeenCalled();
      expect(mockTx.inventoryTransaction.create).not.toHaveBeenCalled();
    });

    it('should create new transaction when idempotencyKey does not exist', async () => {
      const movements = [
        {
          id: 'mov-1',
          quantity: new Prisma.Decimal(-10),
          costPerUnit: new Prisma.Decimal(10),
          currency: 'RUB',
        },
      ];

      mockTx.inventoryTransaction.findUnique.mockResolvedValueOnce(null);
      fifoService.recordOutcome.mockResolvedValueOnce({
        movements,
        totalCost: new Prisma.Decimal(100),
        totalCostBase: new Prisma.Decimal(100),
        currency: 'USD',
        baseCurrency: 'USD',
        totalQuantity: new Prisma.Decimal(10),
      });
      mockTx.inventoryTransaction.create.mockResolvedValueOnce({
        id: 'txn-new',
        idempotencyKey: 'invtx:v1:PRODUCTION_CONSUMPTION:cons-123:OUT',
      } as any);
      mockTx.stockMovement.update.mockResolvedValue({} as any);
      (mockTx as any).inventoryBalance.upsert.mockResolvedValueOnce({} as any);
      eventsService.emitStockChanged.mockResolvedValueOnce(undefined);

      const result = await service.recordOutcome(
        {
          warehouseId: 'wh-1',
          itemId: 'item-1',
          quantity: 10,
          docType: InventoryDocumentType.PRODUCTION_CONSUMPTION,
          docId: 'cons-123',
          movementType: InventoryMovementType.OUTCOME,
          meta: {},
        },
        mockTx as any,
      );

      expect(result.transactionId).toBe('txn-new');
      expect(result.movementIds).toEqual(['mov-1']);
      expect(fifoService.recordOutcome).toHaveBeenCalled();
      expect(mockTx.inventoryTransaction.create).toHaveBeenCalled();
      expect((mockTx as any).inventoryBalance.upsert).toHaveBeenCalled();
    });
  });

  describe('recordOutcome - multi-movement events', () => {
    it('should emit STOCK_CHANGED event for each movement with correct payload', async () => {
      const movements = [
        {
          id: 'mov-1',
          batchId: 'batch-1',
          quantity: new Prisma.Decimal(-5),
          costPerUnit: new Prisma.Decimal(10),
          currency: 'RUB',
        },
        {
          id: 'mov-2',
          batchId: 'batch-2',
          quantity: new Prisma.Decimal(-3),
          costPerUnit: new Prisma.Decimal(10),
          currency: 'RUB',
        },
        {
          id: 'mov-3',
          batchId: 'batch-3',
          quantity: new Prisma.Decimal(-2),
          costPerUnit: new Prisma.Decimal(10),
          currency: 'RUB',
        },
      ];

      mockTx.inventoryTransaction.findUnique.mockResolvedValueOnce(null);
      fifoService.recordOutcome.mockResolvedValueOnce({
        movements,
        totalCost: new Prisma.Decimal(100),
        totalCostBase: new Prisma.Decimal(100),
        currency: 'USD',
        baseCurrency: 'USD',
        totalQuantity: new Prisma.Decimal(10),
      });
      mockTx.inventoryTransaction.create.mockResolvedValueOnce({
        id: 'txn-new',
        idempotencyKey: 'invtx:v1:PRODUCTION_CONSUMPTION:cons-123:OUT',
      } as any);
      mockTx.stockMovement.update.mockResolvedValue({} as any);
      (mockTx as any).inventoryBalance.upsert.mockResolvedValueOnce({} as any);
      eventsService.emitStockChanged.mockResolvedValue(undefined);

      const result = await service.recordOutcome(
        {
          warehouseId: 'wh-1',
          itemId: 'item-1',
          quantity: 10,
          docType: InventoryDocumentType.PRODUCTION_CONSUMPTION,
          docId: 'cons-123',
          movementType: InventoryMovementType.OUTCOME,
          meta: {},
          sourceDocType: AccountingDocType.PRODUCTION_CONSUMPTION,
          sourceDocId: 'cons-123',
        },
        mockTx as any,
      );

      expect(result.transactionId).toBe('txn-new');
      expect(result.movementIds).toEqual(['mov-1', 'mov-2', 'mov-3']);

      // Verify 3 events were emitted (one per movement)
      expect(eventsService.emitStockChanged).toHaveBeenCalledTimes(3);

      // Verify first event payload
      expect(eventsService.emitStockChanged).toHaveBeenNthCalledWith(
        1,
        mockTx,
        expect.objectContaining({
          warehouseId: 'wh-1',
          itemId: 'item-1',
          qtyDelta: -5, // Negative for OUT
          movementType: InventoryMovementType.OUTCOME,
          movementId: 'mov-1',
          batchId: 'batch-1',
          sourceDocType: AccountingDocType.PRODUCTION_CONSUMPTION,
          sourceDocId: 'cons-123',
          docType: InventoryDocumentType.PRODUCTION_CONSUMPTION,
          docId: 'cons-123',
          inventoryTransactionId: 'txn-new',
          eventVersion: 1,
        }),
      );

      // Verify second event payload
      expect(eventsService.emitStockChanged).toHaveBeenNthCalledWith(
        2,
        mockTx,
        expect.objectContaining({
          movementId: 'mov-2',
          batchId: 'batch-2',
          qtyDelta: -3,
          inventoryTransactionId: 'txn-new', // Same correlationId
        }),
      );

      // Verify third event payload
      expect(eventsService.emitStockChanged).toHaveBeenNthCalledWith(
        3,
        mockTx,
        expect.objectContaining({
          movementId: 'mov-3',
          batchId: 'batch-3',
          qtyDelta: -2,
          inventoryTransactionId: 'txn-new', // Same correlationId
        }),
      );
      expect((mockTx as any).inventoryBalance.upsert).toHaveBeenCalled();
    });

    it('should emit events with correct qtyDelta signs (IN positive, OUT negative)', async () => {
      const incomeMovement = {
        id: 'mov-income',
        batchId: 'batch-1',
        quantity: new Prisma.Decimal(10),
      };

      mockTx.inventoryTransaction.findUnique.mockResolvedValueOnce(null);
      fifoService.recordIncome.mockResolvedValueOnce(incomeMovement as any);
      mockTx.inventoryTransaction.create.mockResolvedValueOnce({
        id: 'txn-income',
      } as any);
      mockTx.stockMovement.update.mockResolvedValueOnce({} as any);
      (mockTx as any).inventoryBalance.upsert.mockResolvedValueOnce({} as any);
      eventsService.emitStockChanged.mockResolvedValue(undefined);

      await service.recordIncome(
        {
          warehouseId: 'wh-1',
          itemId: 'item-1',
          quantity: 10,
          docType: InventoryDocumentType.SUPPLY_RECEIPT,
          docId: 'receipt-123',
          movementType: InventoryMovementType.INCOME,
          meta: {},
        },
        mockTx as any,
      );

      // Verify IN event has positive qtyDelta
      expect(eventsService.emitStockChanged).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          qtyDelta: 10, // Positive for IN
          movementType: InventoryMovementType.INCOME,
        }),
      );
    });
  });
});


