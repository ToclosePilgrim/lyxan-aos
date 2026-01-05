import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AccountingEntryService } from './accounting-entry.service';
import { ListAccountingEntriesDto } from './dto/list-accounting-entries.dto';
import { ListAccountingEntriesByDocDto } from './dto/list-accounting-entries-by-doc.dto';

@ApiTags('finance/accounting-entries')
@Controller('finance/accounting-entries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountingEntryController {
  constructor(private readonly service: AccountingEntryService) {}

  @Get()
  @Roles('Admin', 'FinanceManager')
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'List accounting entries (ledger)',
    description: 'Read-only ledger query',
  })
  async list(@Query() query: ListAccountingEntriesDto) {
    return this.service.list({
      docType: query.docType,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
      debitAccount: query.debitAccount,
      creditAccount: query.creditAccount,
      limit: query.limit,
    });
  }

  @Get('by-document')
  @Roles('Admin', 'FinanceManager')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get accounting entries by document' })
  async byDocument(@Query() query: ListAccountingEntriesByDocDto) {
    return this.service.listByDocument({
      docType: query.docType,
      docId: query.docId,
    });
  }
}
