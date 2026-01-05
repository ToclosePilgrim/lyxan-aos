import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { AccountingEntryModule } from '../accounting-entry/accounting-entry.module';
import { CashAccountingLinksModule } from '../cash-accounting-links/cash-accounting-links.module';
import { CurrencyRateModule } from '../currency-rates/currency-rate.module';
import { MoneyTransactionsModule } from '../money-transactions/money-transactions.module';
import { PostingRunsModule } from '../posting-runs/posting-runs.module';
import { CashTransfersController } from './cash-transfers.controller';
import { CashTransfersService } from './cash-transfers.service';

@Module({
  imports: [
    DatabaseModule,
    CurrencyRateModule,
    AccountingEntryModule,
    CashAccountingLinksModule,
    MoneyTransactionsModule,
    PostingRunsModule,
  ],
  controllers: [CashTransfersController],
  providers: [CashTransfersService],
  exports: [CashTransfersService],
})
export class CashTransfersModule {}
