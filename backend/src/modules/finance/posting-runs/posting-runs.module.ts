import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { AccountingEntryModule } from '../accounting-entry/accounting-entry.module';
import { PostingRunsService } from './posting-runs.service';

@Module({
  imports: [DatabaseModule, AccountingEntryModule],
  providers: [PostingRunsService],
  exports: [PostingRunsService],
})
export class PostingRunsModule {}




