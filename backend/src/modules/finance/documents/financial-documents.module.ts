import { Module } from '@nestjs/common';
import { FinancialDocumentsController } from './financial-documents.controller';
import { FinancialDocumentsService } from './financial-documents.service';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [FinancialDocumentsController],
  providers: [FinancialDocumentsService],
  exports: [FinancialDocumentsService],
})
export class FinancialDocumentsModule {}




