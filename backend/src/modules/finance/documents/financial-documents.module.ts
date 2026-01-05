import { Module } from '@nestjs/common';
import { FinancialDocumentsController } from './financial-documents.controller';
import { FinancialDocumentsService } from './financial-documents.service';
import { DatabaseModule } from '../../../database/database.module';
import { CurrencyRateModule } from '../currency-rates/currency-rate.module';
import { AccountingEntryModule } from '../accounting-entry/accounting-entry.module';
import { CategoryDefaultMappingsModule } from '../category-default-mappings/category-default-mappings.module';
import { RecurringJournalsModule } from '../recurring-journals/recurring-journals.module';
import { PostingRunsModule } from '../posting-runs/posting-runs.module';

@Module({
  imports: [
    DatabaseModule,
    CurrencyRateModule,
    AccountingEntryModule,
    CategoryDefaultMappingsModule,
    RecurringJournalsModule,
    PostingRunsModule,
  ],
  controllers: [FinancialDocumentsController],
  providers: [FinancialDocumentsService],
  exports: [FinancialDocumentsService],
})
export class FinancialDocumentsModule {}
