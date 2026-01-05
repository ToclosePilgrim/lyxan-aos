import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ReconciliationControlsService } from './reconciliation-controls.service';
import { ControlsFiltersDto } from './dto/controls-filters.dto';
import { ControlsQueueDto } from './dto/controls-queue.dto';
import { BatchSuggestDto } from './dto/batch-suggest.dto';
import { BatchPostDto } from './dto/batch-post.dto';
import { BatchIgnoreDto } from './dto/batch-ignore.dto';

@ApiTags('finance/reconciliation')
@Controller('finance/reconciliation/controls')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class ReconciliationControlsController {
  constructor(private readonly controls: ReconciliationControlsService) {}

  @Get('summary')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Reconciliation controls summary' })
  summary(@Query() q: ControlsFiltersDto) {
    return this.controls.getSummary({
      legalEntityId: q.legalEntityId,
      accountId: q.accountId,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });
  }

  @Get('queue')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Reconciliation queue by type' })
  queue(@Query() q: ControlsQueueDto) {
    return this.controls.getQueue(q.type as any, {
      legalEntityId: q.legalEntityId,
      accountId: q.accountId,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      limit: q.limit,
    });
  }

  @Post('retry-suggest')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch retry suggest (NEW/ERROR)' })
  retrySuggest(@Body() dto: BatchSuggestDto) {
    return this.controls.batchRetrySuggest({
      legalEntityId: dto.legalEntityId,
      accountId: dto.accountId,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      limit: dto.limit,
    });
  }

  @Post('retry-post')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch retry post (MATCHED/ERROR)' })
  retryPost(@Body() dto: BatchPostDto) {
    return this.controls.batchRetryPost({
      legalEntityId: dto.legalEntityId,
      accountId: dto.accountId,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      limit: dto.limit,
    });
  }

  @Post('ignore')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch ignore lines by ids' })
  ignore(@Body() dto: BatchIgnoreDto) {
    return this.controls.batchIgnore(dto.ids, dto.reason);
  }
}
