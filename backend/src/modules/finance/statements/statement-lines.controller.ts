import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { StatementLineStatus } from '@prisma/client';
import { StatementLinesService } from './statement-lines.service';

@ApiTags('finance/statement-lines')
@Controller('finance')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class StatementLinesController {
  constructor(private readonly lines: StatementLinesService) {}

  @Get('statement-lines')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List statement lines with filters' })
  list(
    @Query('legalEntityId') legalEntityId?: string,
    @Query('accountId') accountId?: string,
    @Query('status') status?: StatementLineStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
  ) {
    return this.lines.list({
      legalEntityId,
      accountId,
      status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      q,
    });
  }

  @Get('statement-lines/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get statement line' })
  getById(@Param('id') id: string) {
    return this.lines.getById(id);
  }
}
