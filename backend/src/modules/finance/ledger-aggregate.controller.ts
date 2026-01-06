import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { LedgerAggregateService } from './ledger-aggregate.service';

@ApiTags('finance/ledger')
@Controller('finance/ledger')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LedgerAggregateController {
  constructor(private readonly ledger: LedgerAggregateService) {}

  @Get('by-supply/:supplyId')
  @Roles('Admin', 'FinanceManager')
  @ApiCookieAuth()
  @ApiOperation({
    summary:
      'Get ledger entries aggregated for a supply (receipts + docs + payments)',
  })
  async supplyLedger(@Param('supplyId') supplyId: string) {
    return this.ledger.getSupplyLedger(supplyId);
  }

  @Get('by-financial-document/:id')
  @Roles('Admin', 'FinanceManager')
  @ApiCookieAuth()
  @ApiOperation({
    summary: 'Get ledger entries for a financial document (doc + payments)',
  })
  async financialDocumentLedger(@Param('id') id: string) {
    return this.ledger.getFinancialDocumentLedger(id);
  }
}




