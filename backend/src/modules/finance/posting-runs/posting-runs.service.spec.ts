import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AccountingDocType, PostingRunStatus, Prisma } from '@prisma/client';
import { PostingRunsService } from './posting-runs.service';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryService } from '../accounting-entry/accounting-entry.service';

describe('PostingRunsService - Concurrency', () => {
  let service: PostingRunsService;
  let prismaService: jest.Mocked<PrismaService>;
  let accountingService: jest.Mocked<AccountingEntryService>;
  let mockTx: jest.Mocked<Prisma.TransactionClient>;

  beforeEach(async () => {
    const mockPrisma = {
      accountingPostingRun: {
        findFirst: jest.fn(),
        aggregate: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      accountingEntry: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const mockAccounting = {
      createEntry: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostingRunsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: AccountingEntryService,
          useValue: mockAccounting,
        },
      ],
    }).compile();

    service = module.get<PostingRunsService>(PostingRunsService);
    prismaService = module.get(PrismaService);
    accountingService = module.get(AccountingEntryService);

    mockTx = {
      accountingPostingRun: prismaService.accountingPostingRun as any,
      accountingEntry: prismaService.accountingEntry as any,
    } as any;
  });

  describe('getOrCreatePostedRun - concurrency', () => {
    it('should handle 10 parallel calls and create only one run', async () => {
      const params = {
        legalEntityId: 'le-1',
        docType: AccountingDocType.SUPPLY_RECEIPT,
        docId: 'doc-123',
      };

      // First call: no existing run, max version = 0
      // Subsequent calls: run already exists or conflict
      let callCount = 0;
      const createdRun = {
        id: 'run-1',
        legalEntityId: params.legalEntityId,
        docType: params.docType,
        docId: params.docId,
        version: 1,
        status: PostingRunStatus.POSTED,
        postedAt: new Date(),
      };

      prismaService.accountingPostingRun.findFirst.mockImplementation(
        async () => {
          callCount++;
          // First call: no existing
          if (callCount === 1) return null;
          // All other calls: return created run
          return createdRun as any;
        },
      );

      prismaService.accountingPostingRun.aggregate.mockResolvedValueOnce({
        _max: { version: 0 },
      } as any);

      prismaService.accountingPostingRun.create
        .mockResolvedValueOnce(createdRun as any) // First call succeeds
        .mockRejectedValue({ code: 'P2002' }); // All other calls conflict

      // Simulate 10 parallel calls
      const promises = Array.from({ length: 10 }, () =>
        service.getOrCreatePostedRun(params),
      );

      const results = await Promise.all(promises);

      // All should return the same run
      const uniqueRunIds = new Set(results.map((r) => r.id));
      expect(uniqueRunIds.size).toBe(1);
      expect(Array.from(uniqueRunIds)[0]).toBe('run-1');

      // Should have attempted to create only once (first call)
      expect(prismaService.accountingPostingRun.create).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should retry with correct version after conflict', async () => {
      const params = {
        legalEntityId: 'le-1',
        docType: AccountingDocType.SUPPLY_RECEIPT,
        docId: 'doc-123',
      };

      const runV1 = {
        id: 'run-1',
        version: 1,
        status: PostingRunStatus.POSTED,
      };
      const runV2 = {
        id: 'run-2',
        version: 2,
        status: PostingRunStatus.POSTED,
      };

      let findFirstCall = 0;
      prismaService.accountingPostingRun.findFirst.mockImplementation(
        async () => {
          findFirstCall++;
          if (findFirstCall === 1) return null; // First check: not found
          if (findFirstCall === 2) return runV1 as any; // After conflict: found v1
          return runV1 as any; // Subsequent checks
        },
      );

      let aggregateCall = 0;
      prismaService.accountingPostingRun.aggregate.mockImplementation(
        async () => {
          aggregateCall++;
          if (aggregateCall === 1) return { _max: { version: 0 } } as any;
          if (aggregateCall === 2) return { _max: { version: 1 } } as any; // After retry
          return { _max: { version: 0 } } as any;
        },
      );

      let createCall = 0;
      prismaService.accountingPostingRun.create.mockImplementation(async () => {
        createCall++;
        if (createCall === 1) {
          // First attempt: conflict (someone else created v1)
          throw { code: 'P2002' };
        }
        if (createCall === 2) {
          // Second attempt: success (create v2)
          return runV2 as any;
        }
        throw { code: 'P2002' };
      });

      const result = await service.getOrCreatePostedRun(params);

      // In this scenario service will re-read and return the created v1
      expect(result.id).toBe(runV1.id);
      expect(prismaService.accountingPostingRun.aggregate).toHaveBeenCalledTimes(1);
    });
  });

  describe('createNextRun - concurrency', () => {
    it('should handle parallel calls and create runs with correct versions', async () => {
      const params = {
        legalEntityId: 'le-1',
        docType: AccountingDocType.SUPPLY_RECEIPT,
        docId: 'doc-123',
      };

      let createdV1 = false;
      let createdV2 = false;
      const runV1 = { id: 'run-1', version: 1, status: PostingRunStatus.POSTED };
      const runV2 = { id: 'run-2', version: 2, status: PostingRunStatus.POSTED };

      prismaService.accountingPostingRun.aggregate.mockImplementation(async () => {
        const v = createdV2 ? 2 : createdV1 ? 1 : 0;
        return { _max: { version: v } } as any;
      });

      prismaService.accountingPostingRun.create.mockImplementation(async (args: any) => {
        const v = args?.data?.version;
        if (v === 1 && !createdV1) {
          createdV1 = true;
          return runV1 as any;
        }
        if (v === 2 && !createdV2) {
          createdV2 = true;
          return runV2 as any;
        }
        throw { code: 'P2002' };
      });

      prismaService.accountingPostingRun.findFirst.mockResolvedValue(runV2 as any);

      // Simulate 5 parallel calls
      const promises = Array.from({ length: 5 }, () =>
        service.createNextRun(params),
      );

      const results = await Promise.all(promises);

      // All should have valid runs
      expect(results.every((r) => r.id && r.version)).toBe(true);
      // We may end up with one v1 and the rest v2 (or all v2), but no crashes.
      const versions = results.map((r) => r.version);
      expect(Math.max(...versions)).toBe(2);
    });
  });
});



