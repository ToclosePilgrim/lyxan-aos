import { Module } from '@nestjs/common';
import { FinancialDocumentsModule } from './documents/financial-documents.module';

@Module({
  imports: [FinancialDocumentsModule],
  exports: [FinancialDocumentsModule],
})
export class FinanceModule {}
