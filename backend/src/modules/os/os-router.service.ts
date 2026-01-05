import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { OsDispatchRequestDto } from './dto/os-dispatch.dto';
import { OsApiResponse, ok, fail } from './os-api.types';
import {
  OsRegistryService,
  OsRegistryObject,
} from '../os-registry/os-registry.service';
import { PrismaService } from '../../database/prisma.service';
import { OS_SERVICE_MAP } from './os-service-map';

@Injectable()
export class OsRouterService {
  constructor(
    private readonly registry: OsRegistryService,
    private readonly moduleRef: ModuleRef,
    private readonly prisma: PrismaService,
  ) {}

  async dispatch(req: OsDispatchRequestDto): Promise<OsApiResponse<unknown>> {
    try {
      const { objectCode, actionCode, payload, context } =
        this.normalizeRequest(req);

      const resolved = await this.registry.resolveHandler(
        objectCode,
        actionCode,
      );
      const { serviceKey, handlerName, action } = resolved;

      this.checkPermissions(action, context);

      const currentStatus = await this.getCurrentStatus(
        resolved.object,
        payload,
      );
      await this.registry.ensureActionAllowedForStatus({
        objectCode,
        actionCode,
        currentStatus,
      });

      const serviceInstance = this.resolveService(serviceKey);

      const result = await this.invokeHandler(
        serviceInstance,
        handlerName,
        payload,
      );

      return ok(result);
    } catch (e: any) {
      return fail(
        e.code ?? 'OS_ROUTER_ERROR',
        e.message ?? 'Unknown error in OS router',
        e.details,
      );
    }
  }

  private async getCurrentStatus(
    object: OsRegistryObject,
    payload: any,
  ): Promise<string | null> {
    if (!object.statusEntityName || !object.statusFieldName) return null;
    const id = this.extractIdFromPayload(object, payload);
    if (!id) return null;

    const repo = this.resolvePrismaRepo(object.statusEntityName);
    if (!repo || !repo.findUnique) return null;

    const record = await repo.findUnique({
      where: { [object.primaryKey ?? 'id']: id },
    } as any);
    if (!record) {
      throw {
        code: 'OS_OBJECT_NOT_FOUND',
        message: `Object ${object.code} with id ${id} not found`,
      };
    }
    return record[object.statusFieldName] ?? null;
  }

  private resolvePrismaRepo(entityName: string): any {
    const key = entityName.charAt(0).toLowerCase() + entityName.slice(1);
    return (this.prisma as any)[key];
  }

  private normalizeRequest(req: OsDispatchRequestDto) {
    return {
      objectCode: req.object.trim().toUpperCase(),
      actionCode: req.action.trim().toUpperCase(),
      payload: req.payload ?? {},
      context: req.context ?? {},
    };
  }

  private resolveService(serviceKey: string): any {
    const token = OS_SERVICE_MAP[serviceKey];
    if (!token) {
      throw {
        code: 'OS_SERVICE_NOT_FOUND',
        message: `Service not found for key: ${serviceKey}`,
      };
    }
    const instance = this.moduleRef.get(token, { strict: false });
    if (!instance) {
      throw {
        code: 'OS_SERVICE_INSTANCE_NOT_FOUND',
        message: `No instance for service key: ${serviceKey}`,
      };
    }
    return instance;
  }

  private async invokeHandler(
    serviceInstance: any,
    handlerName: string,
    payload: any,
  ) {
    const handler = serviceInstance[handlerName];
    if (typeof handler !== 'function') {
      throw {
        code: 'OS_HANDLER_NOT_FOUND',
        message: `Handler ${handlerName} not found in service`,
        details: { service: serviceInstance.constructor?.name },
      };
    }
    return handler.call(serviceInstance, payload);
  }

  private checkPermissions(action: any, context: any) {
    const role = context?.role ?? 'AGENT';
    if (role === 'AGENT' && action.enabledForAgents === false) {
      throw {
        code: 'OS_ACTION_FORBIDDEN_FOR_AGENT',
        message: `Action ${action.code} is not allowed for agents`,
      };
    }
    if (
      action.requiredRole &&
      role !== action.requiredRole &&
      role !== 'SYSTEM'
    ) {
      throw {
        code: 'OS_ACTION_FORBIDDEN',
        message: `Action ${action.code} requires role ${action.requiredRole}`,
        details: { role },
      };
    }
  }

  private extractIdFromPayload(
    object: OsRegistryObject,
    payload: any,
  ): string | null {
    const key = object.idPayloadKey || 'id';
    const id = payload?.[key] ?? payload?.id ?? null;
    return id ?? null;
  }
}
