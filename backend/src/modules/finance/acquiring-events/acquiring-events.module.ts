import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CurrencyRateModule } from '../currency-rates/currency-rate.module';
import { AccountingEntryModule } from '../accounting-entry/accounting-entry.module';
import { PostingRunsModule } from '../posting-runs/posting-runs.module';
import { AcquiringEventsController } from './acquiring-events.controller';
import { AcquiringEventsService } from './acquiring-events.service';
import { AcquiringPostingService } from './acquiring-posting.service';

@Module({
  imports: [
    DatabaseModule,
    CurrencyRateModule,
    AccountingEntryModule,
    PostingRunsModule,
  ],
  controllers: [AcquiringEventsController],
  providers: [AcquiringEventsService, AcquiringPostingService],
  exports: [AcquiringEventsService, AcquiringPostingService],
})
export class AcquiringEventsModule {}
