import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AcquiringEventsService } from './acquiring-events.service';
import { AcquiringPostingService } from './acquiring-posting.service';
import { ImportAcquiringEventsDto } from './dto/import-acquiring-events.dto';
import { ListAcquiringEventsDto } from './dto/list-acquiring-events.dto';
import { BatchPostAcquiringEventsDto } from './dto/batch-post-acquiring-events.dto';
import { LinkStatementLineDto } from './dto/link-statement-line.dto';
import { VoidAcquiringEventDto } from './dto/void-acquiring-event.dto';

@ApiTags('finance/acquiring-events')
@Controller('finance/acquiring-events')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class AcquiringEventsController {
  constructor(
    private readonly events: AcquiringEventsService,
    private readonly posting: AcquiringPostingService,
  ) {}

  @Post('import')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import acquiring events (idempotent by unique key)',
  })
  import(@Body() dto: ImportAcquiringEventsDto) {
    return this.events.import({
      legalEntityId: dto.legalEntityId,
      provider: dto.provider,
      raw: dto.raw,
      events: dto.events.map((e) => ({
        eventType: e.eventType,
        occurredAt: new Date(e.occurredAt),
        amount: e.amount,
        currency: e.currency,
        externalRef: e.externalRef,
        orderId: e.orderId ?? null,
      })),
    });
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List acquiring events' })
  list(@Query() q: ListAcquiringEventsDto) {
    return this.events.list({
      legalEntityId: q.legalEntityId,
      provider: q.provider,
      status: q.status as any,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });
  }

  @Post(':id/post')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Post acquiring event to ledger (idempotent via docLineId)',
  })
  post(@Param('id') id: string) {
    return this.posting.postEvent(id);
  }

  @Post(':id/void')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Void acquiring event posting via PostingRun (reversal entries)',
  })
  void(@Param('id') id: string, @Body() dto: VoidAcquiringEventDto) {
    return this.posting.voidEvent(id, dto.reason);
  }

  @Post('post')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch post IMPORTED acquiring events' })
  postBatch(@Body() dto: BatchPostAcquiringEventsDto) {
    return this.posting.postBatch({
      legalEntityId: dto.legalEntityId,
      provider: dto.provider,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      limit: dto.limit,
    });
  }

  @Post(':id/link-statement-line')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually link acquiring event to a bank statement line',
  })
  linkStatementLine(
    @Param('id') id: string,
    @Body() dto: LinkStatementLineDto,
  ) {
    return this.events.linkStatementLine(id, dto.statementLineId);
  }
}
