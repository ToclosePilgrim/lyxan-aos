import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { EntityExplainDto } from './entity-explain.dto';
import { ExplainService } from './explain.service';

@ApiTags('finance/explain')
@Controller('finance/explain')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiCookieAuth()
export class ExplainController {
  constructor(private readonly explain: ExplainService) {}

  @Get('entity')
  @Roles('Admin', 'FinanceManager', 'Manager')
  @ApiOperation({ summary: 'Universal explain for entity (1-hop graph)' })
  explainEntity(@Query() q: EntityExplainDto) {
    return this.explain.explainEntity({ type: q.type, id: q.id });
  }
}

