import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OsRouterService } from './os-router.service';
import { OsDispatchRequestDto } from './dto/os-dispatch.dto';
import { OsApiResponse } from './os-api.types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('os-router')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('os/v1')
export class OsRouterController {
  constructor(private readonly router: OsRouterService) {}

  @Post('dispatch')
  @ApiOperation({ summary: 'Dispatch OS action (object/action)' })
  async dispatch(
    @Body() body: OsDispatchRequestDto,
  ): Promise<OsApiResponse<unknown>> {
    return this.router.dispatch(body);
  }
}
