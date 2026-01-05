import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { OsRegistryService } from '../os-registry/os-registry.service';
import { OS_SERVICE_MAP } from './os-service-map';

export class OsSelfValidateError extends Error {
  constructor(
    public code: string,
    public details?: Record<string, any>,
  ) {
    super(code);
  }
}

const STATUS_ENTITY_TO_REPO: Record<string, (p: PrismaService) => any> = {
  ScmSupply: (p) => (p as any).scmSupply,
  SalesDocument: (p) => (p as any).salesDocument,
  FinancialDocument: (p) => (p as any).financialDocument,
  InventoryBalance: (p) => (p as any).inventoryBalance,
  InventoryAdjustment: (p) => (p as any).inventoryAdjustment,
  StockTransfer: (p) => (p as any).stockTransfer,
  // Future-ready: ProductionOrder/ProductionOutput can be added here.
};

@Injectable()
export class OsSelfValidateService {
  constructor(
    private readonly registry: OsRegistryService,
    private readonly moduleRef: ModuleRef,
    private readonly prisma: PrismaService,
  ) {}

  async validateAll(): Promise<void> {
    await this.validateObjectsAndActions();
    await this.validateStatusRepositories();
  }

  private async validateObjectsAndActions() {
    const objects = await this.registry.listObjects();
    for (const obj of objects) {
      if (obj.serviceKey) {
        const token = OS_SERVICE_MAP[obj.serviceKey];
        if (!token) {
          throw new OsSelfValidateError('OS_SERVICE_NOT_FOUND', {
            objectCode: obj.code,
            serviceKey: obj.serviceKey,
          });
        }
        const instance = this.moduleRef.get(token, { strict: false });
        if (!instance) {
          throw new OsSelfValidateError('OS_SERVICE_INSTANCE_NOT_FOUND', {
            objectCode: obj.code,
            serviceKey: obj.serviceKey,
          });
        }
        const actions = await this.registry.listActionsForObject(obj.code);
        for (const action of actions) {
          if (!action.handlerName) {
            throw new OsSelfValidateError('OS_HANDLER_EMPTY', {
              objectCode: obj.code,
              actionCode: action.code,
            });
          }
          const handler = (instance as any)[action.handlerName];
          if (typeof handler !== 'function') {
            throw new OsSelfValidateError('OS_HANDLER_NOT_FOUND', {
              objectCode: obj.code,
              actionCode: action.code,
              handlerName: action.handlerName,
              serviceKey: obj.serviceKey,
            });
          }
        }
      }
    }
  }

  private async validateStatusRepositories() {
    const objects = await this.registry.listObjects();
    for (const obj of objects) {
      if (!obj.statusEntityName || !obj.statusFieldName) continue;
      const getter = STATUS_ENTITY_TO_REPO[obj.statusEntityName];
      if (!getter) {
        throw new OsSelfValidateError('OS_STATUS_REPO_NOT_MAPPED', {
          objectCode: obj.code,
          statusEntityName: obj.statusEntityName,
        });
      }
      const repo = getter(this.prisma);
      if (!repo || typeof repo.findFirst !== 'function') {
        throw new OsSelfValidateError('OS_STATUS_REPO_INVALID', {
          objectCode: obj.code,
          statusEntityName: obj.statusEntityName,
        });
      }
      await repo
        .findFirst({ select: { [obj.statusFieldName]: true } })
        .catch((err: any) => {
          throw new OsSelfValidateError('OS_STATUS_FIELD_INVALID', {
            objectCode: obj.code,
            statusEntityName: obj.statusEntityName,
            statusFieldName: obj.statusFieldName,
            error: String(err),
          });
        });
    }
  }
}
