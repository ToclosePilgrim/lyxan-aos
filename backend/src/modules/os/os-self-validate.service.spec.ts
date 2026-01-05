import { Test } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { OsRegistryService } from '../os-registry/os-registry.service';
import {
  OsSelfValidateService,
  OsSelfValidateError,
} from './os-self-validate.service';

describe('OsSelfValidateService', () => {
  let service: OsSelfValidateService;
  let registry: Partial<OsRegistryService>;
  let moduleRef: Partial<ModuleRef>;
  let prisma: Partial<PrismaService>;

  const mockServiceInstance = {
    confirmReceiveOs: () => undefined,
    postSalesDocument: () => undefined,
    validateSalesDocument: () => undefined,
  };

  beforeEach(async () => {
    registry = {
      listObjects: jest.fn().mockResolvedValue([
        {
          code: 'SUPPLY',
          name: 'Supply',
          domain: 'SCM',
          serviceKey: 'ScmSuppliesService',
          statusEntityName: 'ScmSupply',
          statusFieldName: 'status',
          actions: [],
        },
        {
          code: 'SALES_DOCUMENT',
          name: 'Sales Document',
          domain: 'FINANCE',
          serviceKey: 'SalesDocumentsService',
          statusEntityName: 'SalesDocument',
          statusFieldName: 'status',
          actions: [],
        },
      ]),
      listActionsForObject: jest.fn().mockImplementation((code: string) => {
        if (code === 'SUPPLY') {
          return Promise.resolve([
            { code: 'CONFIRM_RECEIVE', handlerName: 'confirmReceiveOs' },
          ]);
        }
        if (code === 'SALES_DOCUMENT') {
          return Promise.resolve([
            { code: 'VALIDATE', handlerName: 'validateSalesDocument' },
            { code: 'POST', handlerName: 'postSalesDocument' },
          ]);
        }
        return Promise.resolve([]);
      }),
    } as any;

    moduleRef = {
      get: jest.fn().mockReturnValue(mockServiceInstance),
    };

    prisma = {
      scmSupply: { findFirst: jest.fn().mockResolvedValue(null) },
      salesDocument: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;

    const moduleRefTesting = await Test.createTestingModule({
      providers: [
        OsSelfValidateService,
        { provide: OsRegistryService, useValue: registry },
        { provide: ModuleRef, useValue: moduleRef },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRefTesting.get(OsSelfValidateService);
  });

  it('passes when services and handlers are valid', async () => {
    await expect(service.validateAll()).resolves.not.toThrow();
  });

  it('fails when serviceKey not mapped', async () => {
    (registry.listObjects as jest.Mock).mockResolvedValueOnce([
      {
        code: 'X',
        name: 'X',
        domain: 'TEST',
        serviceKey: 'UnknownService',
        actions: [],
      },
    ]);
    await expect(service.validateAll()).rejects.toThrow(OsSelfValidateError);
  });

  it('fails when handler missing', async () => {
    (registry.listActionsForObject as jest.Mock).mockResolvedValueOnce([
      { code: 'CONFIRM_RECEIVE', handlerName: 'missingHandler' },
    ]);
    await expect(service.validateAll()).rejects.toThrow(OsSelfValidateError);
  });

  it('fails when status repo not mapped', async () => {
    // validateAll() calls listObjects() twice: for objects/actions and for status repos
    (registry.listObjects as jest.Mock)
      .mockResolvedValueOnce([
        {
          code: 'BAD',
          name: 'Bad',
          domain: 'TEST',
          serviceKey: 'ScmSuppliesService',
          statusEntityName: 'UnknownEntity',
          statusFieldName: 'status',
          actions: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          code: 'BAD',
          name: 'Bad',
          domain: 'TEST',
          serviceKey: 'ScmSuppliesService',
          statusEntityName: 'UnknownEntity',
          statusFieldName: 'status',
          actions: [],
        },
      ]);
    await expect(service.validateAll()).rejects.toThrow(OsSelfValidateError);
  });

  describe('validateStatusRepositories', () => {
    const baseStatusObjects = [
      {
        code: 'SUPPLY',
        name: 'Supply',
        domain: 'SCM',
        statusEntityName: 'ScmSupply',
        statusFieldName: 'status',
      },
      {
        code: 'SALES_DOCUMENT',
        name: 'Sales Document',
        domain: 'FINANCE',
        statusEntityName: 'SalesDocument',
        statusFieldName: 'status',
      },
      {
        code: 'INVENTORY_ADJUSTMENT',
        name: 'Inventory Adjustment',
        domain: 'INVENTORY',
        statusEntityName: 'InventoryAdjustment',
        statusFieldName: 'status',
      },
      {
        code: 'STOCK_TRANSFER',
        name: 'Stock Transfer',
        domain: 'INVENTORY',
        statusEntityName: 'StockTransfer',
        statusFieldName: 'status',
      },
    ];

    const buildService = async (overrides: {
      objects?: any[];
      prismaRepos?: Record<string, any>;
    }) => {
      const registryMock: Partial<OsRegistryService> = {
        listObjects: jest
          .fn()
          .mockResolvedValue(overrides.objects ?? baseStatusObjects),
        listActionsForObject: jest.fn().mockResolvedValue([]),
      } as any;

      const prismaMock: Partial<PrismaService> = {
        scmSupply: { findFirst: jest.fn().mockResolvedValue(null) },
        salesDocument: { findFirst: jest.fn().mockResolvedValue(null) },
        inventoryAdjustment: { findFirst: jest.fn().mockResolvedValue(null) },
        stockTransfer: { findFirst: jest.fn().mockResolvedValue(null) },
        ...(overrides.prismaRepos ?? {}),
      };

      const moduleRefMock: Partial<ModuleRef> = {
        get: jest.fn().mockReturnValue({}),
      };

      const moduleRefTesting = await Test.createTestingModule({
        providers: [
          OsSelfValidateService,
          { provide: OsRegistryService, useValue: registryMock },
          { provide: ModuleRef, useValue: moduleRefMock },
          { provide: PrismaService, useValue: prismaMock },
        ],
      }).compile();

      return moduleRefTesting.get(OsSelfValidateService);
    };

    it('passes when all status repos are mapped and fields exist', async () => {
      const svc = await buildService({});
      await expect(
        (svc as any)['validateStatusRepositories'](),
      ).resolves.not.toThrow();
    });

    it('fails when status repo mapping is missing', async () => {
      const svc = await buildService({
        objects: [
          ...baseStatusObjects,
          {
            code: 'BROKEN',
            name: 'Broken',
            domain: 'TEST',
            statusEntityName: 'MissingEntity',
            statusFieldName: 'status',
          },
        ],
      });
      await expect(
        (svc as any)['validateStatusRepositories'](),
      ).rejects.toThrow(OsSelfValidateError);
    });

    it('fails when status field is invalid', async () => {
      const svc = await buildService({
        prismaRepos: {
          salesDocument: {
            findFirst: jest
              .fn()
              .mockRejectedValue(new Error('Unknown column status')),
          },
        },
      });
      await expect(
        (svc as any)['validateStatusRepositories'](),
      ).rejects.toThrow(OsSelfValidateError);
    });
  });
});
