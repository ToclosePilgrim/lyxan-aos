import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { BalanceSheetReportService } from './balance-sheet-report.service';
import { GetBalanceSheetDto } from './dto/get-balance-sheet.dto';
import { ExplainBalanceSheetAccountDto } from './dto/explain-balance-sheet-account.dto';
import { GetCashflowDto } from './dto/get-cashflow.dto';
import { ExplainCashflowDto } from './dto/explain-cashflow.dto';
import { CashflowReportService } from './cashflow-report.service';

@ApiTags('finance/reports')
@Controller('finance/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiCookieAuth()
export class BalanceSheetReportController {
  constructor(
    private readonly service: BalanceSheetReportService,
    private readonly cashflow: CashflowReportService,
  ) {}

  @Get('balance-sheet')
  @Roles('Admin', 'FinanceManager', 'Manager')
  @ApiOperation({ summary: 'Balance sheet report (base currency) at date' })
  getBalanceSheet(@Query() q: GetBalanceSheetDto) {
    const includeZero =
      String(q.includeZero ?? 'false').toLowerCase() === 'true';
    return this.service.getBalanceSheet({
      legalEntityId: q.legalEntityId,
      at: q.at,
      includeZero,
    });
  }

  @Get('balance-sheet/explain')
  @Roles('Admin', 'FinanceManager', 'Manager')
  @ApiOperation({
    summary:
      'Explain balance sheet account by listing entries affecting account',
  })
  explain(@Query() q: ExplainBalanceSheetAccountDto) {
    return this.service.explainAccount({
      legalEntityId: q.legalEntityId,
      at: q.at,
      accountId: q.accountId,
      from: q.from,
      limit: q.limit,
      offset: q.offset,
    });
  }

  @Get('cashflow')
  @Roles('Admin', 'FinanceManager', 'Manager')
  @ApiOperation({
    summary:
      'Cashflow report (MoneyTransaction) with reconciliation to cash delta',
  })
  getCashflow(@Query() q: GetCashflowDto) {
    const includeTransfers =
      String(q.includeTransfers ?? 'true').toLowerCase() !== 'false';
    return this.cashflow.getCashflow({
      legalEntityId: q.legalEntityId,
      from: q.from,
      to: q.to,
      groupBy: q.groupBy ?? 'category',
      includeTransfers,
    });
  }

  @Get('cashflow/explain')
  @Roles('Admin', 'FinanceManager', 'Manager')
  @ApiOperation({
    summary: 'Explain cashflow category by listing MoneyTransactions',
  })
  explainCashflow(@Query() q: ExplainCashflowDto) {
    return this.cashflow.explainCategory({
      legalEntityId: q.legalEntityId,
      from: q.from,
      to: q.to,
      cashflowCategoryId: q.cashflowCategoryId,
      limit: q.limit,
      offset: q.offset,
    });
  }
}
