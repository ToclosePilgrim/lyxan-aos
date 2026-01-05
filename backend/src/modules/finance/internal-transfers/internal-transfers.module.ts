import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { AccountingEntryModule } from '../accounting-entry/accounting-entry.module';
import { CashAccountingLinksModule } from '../cash-accounting-links/cash-accounting-links.module';
import { PostingRunsModule } from '../posting-runs/posting-runs.module';
import { InternalTransfersController } from './internal-transfers.controller';
import { InternalTransfersService } from './internal-transfers.service';

@Module({
  imports: [
    DatabaseModule,
    AccountingEntryModule,
    CashAccountingLinksModule,
    PostingRunsModule,
  ],
  controllers: [InternalTransfersController],
  providers: [InternalTransfersService],
  exports: [InternalTransfersService],
})
export class InternalTransfersModule {}
