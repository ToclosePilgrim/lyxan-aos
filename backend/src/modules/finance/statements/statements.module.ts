import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CurrencyRateModule } from '../currency-rates/currency-rate.module';
import { StatementImportService } from './statement-import.service';
import { StatementMatchingService } from './statement-matching.service';
import { StatementsPostingService } from './statements-posting.service';
import { ReconciliationControlsService } from './reconciliation-controls.service';
import { StatementsController } from './statements.controller';
import { StatementsService } from './statements.service';
import { MoneyTransactionsModule } from '../money-transactions/money-transactions.module';
import { CashAccountingLinksModule } from '../cash-accounting-links/cash-accounting-links.module';
import { ReconciliationControlsController } from './reconciliation-controls.controller';
import { AccountingEntryModule } from '../accounting-entry/accounting-entry.module';
import { CategoryDefaultMappingsModule } from '../category-default-mappings/category-default-mappings.module';
import { PostingRunsModule } from '../posting-runs/posting-runs.module';

@Module({
  imports: [
    DatabaseModule,
    CurrencyRateModule,
    MoneyTransactionsModule,
    CashAccountingLinksModule,
    AccountingEntryModule,
    CategoryDefaultMappingsModule,
    PostingRunsModule,
  ],
  controllers: [StatementsController, ReconciliationControlsController],
  providers: [
    StatementImportService,
    StatementMatchingService,
    StatementsPostingService,
    ReconciliationControlsService,
    StatementsService,
  ],
  exports: [
    StatementImportService,
    StatementMatchingService,
    StatementsPostingService,
    ReconciliationControlsService,
    StatementsService,
  ],
})
export class StatementsModule {}
