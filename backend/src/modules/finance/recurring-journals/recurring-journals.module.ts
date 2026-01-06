import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { AccountingEntryModule } from '../accounting-entry/accounting-entry.module';
import { RecurringJournalsController } from './recurring-journals.controller';
import { RecurringJournalsService } from './recurring-journals.service';

@Module({
  imports: [DatabaseModule, AccountingEntryModule],
  controllers: [RecurringJournalsController],
  providers: [RecurringJournalsService],
  exports: [RecurringJournalsService],
})
export class RecurringJournalsModule {}




