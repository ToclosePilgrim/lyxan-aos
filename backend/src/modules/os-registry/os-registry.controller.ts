import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OsRegistryService } from './os-registry.service';
import { ok, fail, OsApiResponse } from '../os/os-api.types';

@ApiTags('os-registry')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('os/v1/registry')
export class OsRegistryController {
  constructor(private readonly registry: OsRegistryService) {}

  @Get('objects')
  @ApiOperation({ summary: 'List OS domain objects' })
  async listObjects(): Promise<OsApiResponse<unknown>> {
    try {
      const data = await this.registry.listObjects();
      return ok(data);
    } catch (e: any) {
      return fail(
        'OS_REGISTRY_LIST_FAILED',
        e?.message ?? 'Failed to list objects',
      );
    }
  }

  @Get('objects/:code')
  @ApiOperation({ summary: 'Get OS domain object by code' })
  async getObject(
    @Param('code') code: string,
  ): Promise<OsApiResponse<unknown>> {
    try {
      const data = await this.registry.getObjectByCode(code);
      if (!data) return fail('OS_OBJECT_NOT_FOUND', `Object ${code} not found`);
      return ok(data);
    } catch (e: any) {
      return fail(
        'OS_OBJECT_FETCH_FAILED',
        e?.message ?? 'Failed to get object',
      );
    }
  }

  @Get('objects/:code/actions/:action')
  @ApiOperation({ summary: 'Get OS action by object+action code' })
  async getAction(
    @Param('code') code: string,
    @Param('action') action: string,
  ): Promise<OsApiResponse<unknown>> {
    try {
      const data = await this.registry.getAction(code, action);
      return ok(data);
    } catch (e: any) {
      return fail(
        e.code ?? 'OS_ACTION_FETCH_FAILED',
        e?.message ?? 'Failed to get action',
      );
    }
  }
}
