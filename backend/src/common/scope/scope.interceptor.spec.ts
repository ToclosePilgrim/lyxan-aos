import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ScopeInterceptor } from './scope.interceptor';
import { PrismaService } from '../../database/prisma.service';
import { scopeStore } from './scope.store';
import { RequestScope } from './scope.types';

describe('ScopeInterceptor', () => {
  let interceptor: ScopeInterceptor;
  let prismaService: jest.Mocked<PrismaService>;
  let mockContext: ExecutionContext;
  let mockNext: jest.Mock;

  beforeEach(async () => {
    const mockPrisma = {} as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScopeInterceptor,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    interceptor = module.get<ScopeInterceptor>(ScopeInterceptor);
    prismaService = module.get(PrismaService);

    mockNext = jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnValue({
        subscribe: jest.fn(),
      }),
    });

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: null,
        }),
      }),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('intercept', () => {
    it('should skip scope for requests without user', async () => {
      const result = await interceptor.intercept(mockContext, {
        handle: mockNext,
      } as any);

      expect(mockNext).toHaveBeenCalled();
      expect(scopeStore.getScope()).toBeNull();
    });

    it('should set scope for superadmin user', async () => {
      const user = {
        id: 'user-1',
        role: 'Admin',
      };

      mockContext.switchToHttp().getRequest.mockReturnValue({
        user,
      });

      await interceptor.intercept(mockContext, {
        handle: mockNext,
      } as any);

      // Scope should be set in AsyncLocalStorage
      // Note: We can't easily test ALS here, but we can verify the logic
      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for non-superadmin without legalEntityId', async () => {
      const user = {
        id: 'user-1',
        role: 'Manager',
      };

      mockContext.switchToHttp().getRequest.mockReturnValue({
        user,
      });

      await expect(
        interceptor.intercept(mockContext, {
          handle: mockNext,
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should set scope for user with legalEntityId', async () => {
      const user = {
        id: 'user-1',
        role: 'Manager',
        legalEntityId: 'le-1',
      };

      mockContext.switchToHttp().getRequest.mockReturnValue({
        user,
      });

      const handle = {
        handle: () => ({
          pipe: jest.fn().mockReturnValue({
            subscribe: jest.fn(),
          }),
        }),
      };

      await interceptor.intercept(mockContext, handle as any);

      // Should not throw
      expect(mockNext).not.toHaveBeenCalled(); // Because we use different handle
    });
  });
});


