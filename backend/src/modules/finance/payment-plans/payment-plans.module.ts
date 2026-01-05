import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CurrencyRateModule } from '../currency-rates/currency-rate.module';
import { PaymentPlansController } from './payment-plans.controller';
import { PaymentPlansService } from './payment-plans.service';

@Module({
  imports: [DatabaseModule, CurrencyRateModule],
  controllers: [PaymentPlansController],
  providers: [PaymentPlansService],
  exports: [PaymentPlansService],
})
export class PaymentPlansModule {}
