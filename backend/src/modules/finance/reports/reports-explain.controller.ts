import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ExplainService } from '../explain/explain.service';
import { ExplainBalanceSheetUnifiedDto } from './dto/explain-bs.dto';
import { ExplainCashflowUnifiedDto } from './dto/explain-cf.dto';

@ApiTags('finance/reports')
@Controller('finance/reports/explain')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiCookieAuth()
export class ReportsExplainController {
  constructor(private readonly explain: ExplainService) {}

  @Get('balance-sheet')
  @Roles('Admin', 'FinanceManager', 'Manager')
  @ApiOperation({
    summary:
      'Unified explain for balance sheet account line -> entries -> links -> primary docs',
  })
  explainBalanceSheet(@Query() q: ExplainBalanceSheetUnifiedDto) {
    return this.explain.explainBalanceSheet({
      legalEntityId: q.legalEntityId,
      at: q.at,
      accountId: q.accountId,
      from: q.from,
      limit: q.limit ?? 50,
      offset: q.offset ?? 0,
    });
  }

  @Get('cashflow')
  @Roles('Admin', 'FinanceManager', 'Manager')
  @ApiOperation({
    summary:
      'Unified explain for cashflow category -> moneyTx -> links -> entries -> primary docs',
  })
  explainCashflow(@Query() q: ExplainCashflowUnifiedDto) {
    return this.explain.explainCashflow({
      legalEntityId: q.legalEntityId,
      from: q.from,
      to: q.to,
      cashflowCategoryId: q.cashflowCategoryId,
      limit: q.limit ?? 50,
      offset: q.offset ?? 0,
    });
  }
}




