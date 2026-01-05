import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { BalanceSheetReportController } from './balance-sheet-report.controller';
import { BalanceSheetReportService } from './balance-sheet-report.service';
import { CashflowReportService } from './cashflow-report.service';
import { ReportsExplainController } from './reports-explain.controller';
import { ExplainModule } from '../explain/explain.module';

@Module({
  imports: [DatabaseModule, ExplainModule],
  controllers: [BalanceSheetReportController, ReportsExplainController],
  providers: [BalanceSheetReportService, CashflowReportService],
  exports: [BalanceSheetReportService, CashflowReportService],
})
export class ReportsModule {}
