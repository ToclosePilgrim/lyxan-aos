import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { FinancialAccountsController } from './financial-accounts.controller';
import { FinancialAccountsService } from './financial-accounts.service';

@Module({
  imports: [DatabaseModule],
  controllers: [FinancialAccountsController],
  providers: [FinancialAccountsService],
  exports: [FinancialAccountsService],
})
export class FinancialAccountsModule {}




