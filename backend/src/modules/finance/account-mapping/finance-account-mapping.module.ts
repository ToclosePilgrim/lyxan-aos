import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { FinanceAccountMappingService } from './finance-account-mapping.service';

@Module({
  imports: [DatabaseModule],
  providers: [FinanceAccountMappingService],
  exports: [FinanceAccountMappingService],
})
export class FinanceAccountMappingModule {}


