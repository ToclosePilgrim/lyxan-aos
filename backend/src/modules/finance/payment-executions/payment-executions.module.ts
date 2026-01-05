import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CurrencyRateModule } from '../currency-rates/currency-rate.module';
import { AccountingEntryModule } from '../accounting-entry/accounting-entry.module';
import { CashAccountingLinksModule } from '../cash-accounting-links/cash-accounting-links.module';
import { MoneyTransactionsModule } from '../money-transactions/money-transactions.module';
import { CategoryDefaultMappingsModule } from '../category-default-mappings/category-default-mappings.module';
import { FinancialDocumentsModule } from '../documents/financial-documents.module';
import { PostingRunsModule } from '../posting-runs/posting-runs.module';
import { PaymentExecutionsController } from './payment-executions.controller';
import { PaymentExecutionsService } from './payment-executions.service';

@Module({
  imports: [
    DatabaseModule,
    CurrencyRateModule,
    AccountingEntryModule,
    CashAccountingLinksModule,
    MoneyTransactionsModule,
    CategoryDefaultMappingsModule,
    FinancialDocumentsModule,
    PostingRunsModule,
  ],
  controllers: [PaymentExecutionsController],
  providers: [PaymentExecutionsService],
  exports: [PaymentExecutionsService],
})
export class PaymentExecutionsModule {}
