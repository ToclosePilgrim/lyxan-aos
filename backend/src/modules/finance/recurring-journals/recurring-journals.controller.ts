import {
  Body,
  Controller,
  Get,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RecurringJournalsService } from './recurring-journals.service';
import { ListRecurringJournalsDto } from './dto/list-recurring-journals.dto';
import { CreateRecurringJournalDto } from './dto/create-recurring-journal.dto';
import { UpdateRecurringJournalDto } from './dto/update-recurring-journal.dto';
import { RunRecurringJournalsDto } from './dto/run-recurring-journals.dto';
import { ListRecurringJournalRunsDto } from './dto/list-recurring-journal-runs.dto';

@ApiTags('finance/recurring-journals')
@Controller('finance/recurring-journals')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class RecurringJournalsController {
  constructor(private readonly service: RecurringJournalsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List recurring journals' })
  list(@Query() q: ListRecurringJournalsDto) {
    if (!q.legalEntityId) {
      // keep API simple (avoid wide scans)
      throw new BadRequestException('legalEntityId is required');
    }
    return this.service.list({
      legalEntityId: q.legalEntityId,
      status: q.status,
      journalType: q.journalType,
    });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create recurring journal (manual)' })
  create(@Body() dto: CreateRecurringJournalDto) {
    return this.service.create(dto as any);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Patch recurring journal' })
  patch(@Param('id') id: string, @Body() dto: UpdateRecurringJournalDto) {
    return this.service.patch(id, dto as any);
  }

  @Post(':id/archive')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive recurring journal' })
  archive(@Param('id') id: string) {
    return this.service.archive(id);
  }

  @Post('run')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Run recurring journals batch (monthly periods), idempotent by period',
  })
  run(@Body() dto: RunRecurringJournalsDto) {
    return this.service.runBatch({
      legalEntityId: dto.legalEntityId,
      from: new Date(dto.from),
      to: new Date(dto.to),
      journalType: dto.journalType,
      limit: dto.limit,
    });
  }

  @Get(':id/runs')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List recurring journal runs' })
  listRuns(@Param('id') id: string, @Query() q: ListRecurringJournalRunsDto) {
    return this.service.listRuns({
      journalId: id,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });
  }
}
