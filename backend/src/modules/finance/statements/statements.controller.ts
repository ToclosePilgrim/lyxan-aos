import {
  Body,
  Controller,
  Get,
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
import { StatementImportService } from './statement-import.service';
import { StatementMatchingService } from './statement-matching.service';
import { StatementsPostingService } from './statements-posting.service';
import { StatementsService } from './statements.service';
import { ImportStatementDto } from './dto/import-statement.dto';
import { ListStatementsDto } from './dto/list-statements.dto';
import { ListStatementLinesDto } from './dto/list-statement-lines.dto';
import { BatchSuggestDto } from './dto/batch-suggest.dto';
import { ConfirmMatchDto } from './dto/confirm-match.dto';
import { BatchPostDto } from './dto/batch-post.dto';
import { SplitStatementLineDto } from './dto/split-statement-line.dto';
import { IgnoreStatementLineDto } from './dto/ignore-statement-line.dto';
import { ReconciliationControlsService } from './reconciliation-controls.service';
import { ClassifyStatementLineDto } from './dto/classify-statement-line.dto';
import { VoidFeePostingDto } from './dto/void-fee-posting.dto';
import { RepostFeePostingDto } from './dto/repost-fee-posting.dto';

@ApiTags('finance/statements')
@Controller('finance')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class StatementsController {
  constructor(
    private readonly importer: StatementImportService,
    private readonly matcher: StatementMatchingService,
    private readonly posting: StatementsPostingService,
    private readonly statements: StatementsService,
    private readonly controls: ReconciliationControlsService,
  ) {}

  @Post('statements/import')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Import statement (idempotent)' })
  import(@Body() dto: ImportStatementDto) {
    return this.importer.import({
      accountId: dto.accountId,
      provider: dto.provider,
      sourceName: dto.sourceName ?? null,
      periodFrom: dto.periodFrom ? new Date(dto.periodFrom) : null,
      periodTo: dto.periodTo ? new Date(dto.periodTo) : null,
      importHash: dto.importHash ?? null,
      lines: dto.lines.map((l) => ({
        occurredAt: new Date(l.occurredAt),
        direction: l.direction,
        amount: l.amount,
        currency: l.currency,
        description: l.description ?? null,
        bankReference: l.bankReference ?? null,
        externalLineId: l.externalLineId ?? null,
        counterpartyName: l.counterpartyName ?? null,
        counterpartyInn: l.counterpartyInn ?? null,
      })),
      raw: { sourceName: dto.sourceName ?? null },
    });
  }

  @Get('statements')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List statements' })
  listStatements(@Query() q: ListStatementsDto) {
    return this.statements.listStatements({
      legalEntityId: q.legalEntityId,
      accountId: q.accountId,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });
  }

  @Get('statements/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get statement by id (with lines)' })
  getStatement(@Param('id') id: string) {
    return this.statements.getStatement(id);
  }

  @Get('statement-lines')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List statement lines with filters/search' })
  listLines(@Query() q: ListStatementLinesDto) {
    return this.statements.listStatementLines({
      legalEntityId: q.legalEntityId,
      accountId: q.accountId,
      status: q.status,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      q: q.q,
      parentLineId: q.parentLineId,
    });
  }

  @Get('statement-lines/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get statement line by id' })
  getLine(@Param('id') id: string) {
    return this.statements.getStatementLine(id);
  }

  @Patch('statement-lines/:id/classify')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Classify a statement line (marketplace fee metadata, cashflow category, etc.)',
  })
  classifyLine(@Param('id') id: string, @Body() dto: ClassifyStatementLineDto) {
    return this.statements.classifyStatementLine(id, dto);
  }

  @Post('statement-lines/:id/suggest')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate auto-matching suggestions for a statement line',
  })
  suggestOne(@Param('id') id: string) {
    return this.matcher.suggestForLine(id);
  }

  @Post('statement-lines/suggest')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Batch generate suggestions for NEW statement lines',
  })
  suggestBatch(@Body() dto: BatchSuggestDto) {
    return this.matcher.suggestBatch({
      legalEntityId: dto.legalEntityId,
      accountId: dto.accountId,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      limit: dto.limit,
    });
  }

  @Post('statement-lines/:id/confirm-match')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a match for statement line (manual)' })
  confirmMatch(@Param('id') id: string, @Body() dto: ConfirmMatchDto) {
    return this.posting.confirmMatch(id, {
      entityType: dto.entityType as any,
      entityId: dto.entityId,
    });
  }

  @Post('statement-lines/:id/post')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Post statement line (MoneyTransaction + CashLinks)',
  })
  postLine(@Param('id') id: string) {
    return this.posting.postLine(id);
  }

  @Post('statement-lines/post')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch post MATCHED statement lines' })
  postBatch(@Body() dto: BatchPostDto) {
    return this.posting.postBatch({
      legalEntityId: dto.legalEntityId,
      accountId: dto.accountId,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      limit: dto.limit,
    });
  }

  @Post('statement-lines/:id/split')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Split statement line into child lines' })
  splitLine(@Param('id') id: string, @Body() dto: SplitStatementLineDto) {
    return this.posting.splitLine(id, {
      splits: dto.splits,
      forceSuggested: dto.forceSuggested ?? false,
    });
  }

  @Post('statement-lines/:id/undo-split')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Undo split (only if children are not POSTED)' })
  undoSplit(@Param('id') id: string) {
    return this.posting.undoSplit(id);
  }

  @Post('statement-lines/:id/ignore')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark statement line as IGNORED' })
  ignoreLine(@Param('id') id: string, @Body() dto: IgnoreStatementLineDto) {
    return this.controls.ignoreLine(id, dto.reason);
  }

  @Post('statement-lines/:id/unignore')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unignore statement line' })
  unignoreLine(@Param('id') id: string) {
    return this.controls.unignoreLine(id);
  }

  @Post('statement-lines/:id/retry-suggest')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry suggest for a statement line (NEW/ERROR)' })
  retrySuggest(@Param('id') id: string) {
    return this.controls.retrySuggest(id);
  }

  @Post('statement-lines/:id/retry-post')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry post for a statement line (MATCHED/ERROR)' })
  retryPost(@Param('id') id: string) {
    return this.controls.retryPost(id);
  }

  @Post('statement-lines/:id/void-fee-posting')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Void fee posting for statement line: either void PostingRun (FEE_ENTRY_CREATED) or unlink (FEE_LINK_ONLY)',
  })
  voidFeePosting(@Param('id') id: string, @Body() dto: VoidFeePostingDto) {
    return this.posting.voidFeePosting(id, dto.reason);
  }

  @Post('statement-lines/:id/repost-fee-posting')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Repost fee posting for statement line (void + next PostingRun version)',
  })
  repostFeePosting(@Param('id') id: string, @Body() dto: RepostFeePostingDto) {
    return this.posting.repostFeePosting(id, dto.reason);
  }

  @Post('statement-lines/:id/clear-error')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear ERROR status and reset to NEW/SUGGESTED' })
  clearError(@Param('id') id: string) {
    return this.controls.clearError(id);
  }
}
