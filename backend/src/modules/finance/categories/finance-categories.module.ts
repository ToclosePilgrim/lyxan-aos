import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CashflowCategoriesController } from './cashflow-categories.controller';
import { PnlCategoriesController } from './pnl-categories.controller';
import { FinanceCategoriesService } from './finance-categories.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CashflowCategoriesController, PnlCategoriesController],
  providers: [FinanceCategoriesService],
  exports: [FinanceCategoriesService],
})
export class FinanceCategoriesModule {}

