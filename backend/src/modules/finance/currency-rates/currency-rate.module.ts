import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CurrencyRateService } from './currency-rate.service';
import { CurrencyRateController } from './currency-rate.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [CurrencyRateController],
  providers: [CurrencyRateService],
  exports: [CurrencyRateService],
})
export class CurrencyRateModule {}




