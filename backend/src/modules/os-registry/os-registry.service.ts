import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { OS_SERVICE_MAP } from '../os/os-service-map';

export interface OsRegistryAction {
  code: string;
  handlerName: string;
  actionType: 'COMMAND' | 'QUERY';
  name: string;
  description?: string;
  httpMethod?: string;
  httpPath?: string;
  isPostingAction?: boolean;
  allowedFromStatuses?: string[];
  targetStatus?: string;
  isBulk?: boolean;
  enabledForAgents?: boolean;
  requiredRole?: string;
  allowWhenNoStatus?: boolean;
}

export interface OsRegistryObject {
  code: string;
  name: string;
  domain: string;
  entityName?: string;
  serviceKey?: string;
  apiBasePath?: string;
  primaryKey?: string;
  idPayloadKey?: string | null;
  description?: string;
  isActive?: boolean;
  isInternal?: boolean;
  statusEntityName?: string;
  statusFieldName?: string;
  statusesDefinition?: string[] | null;
  actions: OsRegistryAction[];
}

@Injectable()
export class OsRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async listObjects(): Promise<OsRegistryObject[]> {
    const objs = await this.prisma.osDomainObject.findMany({
      include: { actions: true, lifecycles: true },
      orderBy: { code: 'asc' },
    });
    return objs.map((o) => this.mapDbObject(o));
  }

  async listActionsForObject(code: string) {
    const obj = await this.prisma.osDomainObject.findUnique({
      where: { code },
      include: { actions: true },
    });
    if (!obj)
      throw {
        code: 'OS_OBJECT_NOT_FOUND',
        message: `Object ${code} not found`,
      };
    return (obj.actions ?? []).map((a) => this.mapDbAction(a));
  }

  async getObjectByCode(code: string): Promise<OsRegistryObject> {
    const o = await this.prisma.osDomainObject.findUnique({
      where: { code },
      include: { actions: true, lifecycles: true },
    });
    if (!o)
      throw {
        code: 'OS_OBJECT_NOT_FOUND',
        message: `Object ${code} not found`,
      };
    return this.mapDbObject(o);
  }

  async getAction(objectCode: string, actionCode: string) {
    const object = await this.getObjectByCode(objectCode);
    const action = object.actions.find((a) => a.code === actionCode);
    if (!action) {
      throw {
        code: 'OS_ACTION_NOT_FOUND',
        message: `Action ${actionCode} not found for object ${objectCode}`,
      };
    }
    return { object, action };
  }

  async resolveHandler(objectCode: string, actionCode: string) {
    const { object, action } = await this.getAction(objectCode, actionCode);
    if (object.isActive === false) {
      throw {
        code: 'OS_OBJECT_INACTIVE',
        message: `Object ${objectCode} inactive`,
      };
    }
    return {
      serviceKey: object.serviceKey!,
      handlerName: action.handlerName,
      action,
      object,
    };
  }

  async ensureActionAllowedForAgents(objectCode: string, actionCode: string) {
    const { action } = await this.getAction(objectCode, actionCode);
    if (action.enabledForAgents === false) {
      throw {
        code: 'OS_ACTION_FORBIDDEN_FOR_AGENT',
        message: `Action ${actionCode} not allowed for agents`,
      };
    }
  }

  async ensureActionAllowedForStatus(params: {
    objectCode: string;
    actionCode: string;
    currentStatus?: string | null;
  }) {
    const { action } = await this.getAction(
      params.objectCode,
      params.actionCode,
    );
    const allowedFrom = Array.isArray(action.allowedFromStatuses)
      ? action.allowedFromStatuses
      : undefined;
    const allowWhenNoStatus = action.allowWhenNoStatus ?? false;

    if (!params.currentStatus) {
      if (!allowWhenNoStatus && allowedFrom && allowedFrom.length > 0) {
        throw {
          code: 'OS_ACTION_STATUS_REQUIRED',
          message: `Action ${params.actionCode} requires status`,
          details: {
            objectCode: params.objectCode,
            allowedFromStatuses: allowedFrom,
          },
        };
      }
      return;
    }

    if (
      allowedFrom &&
      allowedFrom.length > 0 &&
      !allowedFrom.includes(params.currentStatus)
    ) {
      throw {
        code: 'OS_ACTION_INVALID_STATUS',
        message: `Action ${params.actionCode} not allowed from status ${params.currentStatus}`,
        details: {
          objectCode: params.objectCode,
          currentStatus: params.currentStatus,
          allowedFromStatuses: allowedFrom,
        },
      };
    }
  }

  async selfValidate() {
    const errors: any[] = [];
    const objects = await this.prisma.osDomainObject.findMany({
      include: { actions: true },
    });

    for (const o of objects) {
      const serviceKey = o.serviceKey ?? '';
      const token = OS_SERVICE_MAP[serviceKey];
      if (!token) {
        errors.push({
          code: 'SERVICE_TOKEN_NOT_FOUND',
          object: o.code,
          serviceKey,
        });
        continue;
      }
      const instance = this.moduleRef.get(token, { strict: false });
      if (!instance) {
        errors.push({
          code: 'SERVICE_INSTANCE_NOT_FOUND',
          object: o.code,
          serviceKey,
        });
      }
      for (const action of o.actions) {
        const handler = instance?.[action.handlerName];
        if (typeof handler !== 'function') {
          errors.push({
            code: 'HANDLER_NOT_FOUND',
            object: o.code,
            action: action.code,
            handlerName: action.handlerName,
            serviceKey,
          });
        }
      }

      if (o.statusEntityName && o.statusFieldName) {
        const repoKey = this.modelToRepoKey(o.statusEntityName);
        const repo = (this.prisma as any)[repoKey];
        if (!repo || typeof repo.findUnique !== 'function') {
          errors.push({
            code: 'STATUS_REPO_NOT_FOUND',
            object: o.code,
            statusEntityName: o.statusEntityName,
          });
        }
      }
    }

    if (errors.length > 0) {
      throw {
        code: 'OS_REGISTRY_INVALID',
        message: 'Registry self-validate failed',
        details: errors,
      };
    }
    return true;
  }

  private mapDbObject(o: any): OsRegistryObject {
    return {
      code: o.code,
      name: o.name,
      domain: o.domain,
      entityName: o.entityName ?? undefined,
      serviceKey: o.serviceKey ?? undefined,
      apiBasePath: o.apiBasePath ?? undefined,
      primaryKey: o.primaryKey ?? 'id',
      idPayloadKey: o.idPayloadKey ?? 'id',
      description: o.description ?? undefined,
      isActive: o.isActive ?? true,
      isInternal: o.isInternal ?? false,
      statusEntityName: o.statusEntityName ?? undefined,
      statusFieldName: o.statusFieldName ?? undefined,
      statusesDefinition: this.parseJsonArray(o.statusesDefinition),
      actions: (o.actions ?? []).map((a: any) => ({
        ...this.mapDbAction(a),
      })),
    };
  }

  private mapDbAction(a: any): OsRegistryAction {
    return {
      code: a.code,
      handlerName: a.handlerName,
      actionType: a.actionType,
      name: a.name,
      description: a.description ?? undefined,
      httpMethod: a.httpMethod ?? undefined,
      httpPath: a.httpPath ?? undefined,
      isPostingAction: a.isPostingAction ?? false,
      allowedFromStatuses: this.parseJsonArray(a.allowedFromStatuses),
      targetStatus: a.targetStatus ?? undefined,
      isBulk: a.isBulk ?? false,
      enabledForAgents: a.enabledForAgents ?? true,
      requiredRole: a.requiredRole ?? undefined,
      allowWhenNoStatus: a.allowWhenNoStatus ?? false,
    };
  }

  private parseJsonArray(value: any): string[] | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  private modelToRepoKey(model: string) {
    return model.charAt(0).toLowerCase() + model.slice(1);
  }
}
