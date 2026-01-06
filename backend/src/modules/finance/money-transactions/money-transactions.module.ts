import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CurrencyRateModule } from '../currency-rates/currency-rate.module';
import { MoneyTransactionsController } from './money-transactions.controller';
import { MoneyTransactionsService } from './money-transactions.service';

@Module({
  imports: [DatabaseModule, CurrencyRateModule],
  controllers: [MoneyTransactionsController],
  providers: [MoneyTransactionsService],
  exports: [MoneyTransactionsService],
})
export class MoneyTransactionsModule {}




