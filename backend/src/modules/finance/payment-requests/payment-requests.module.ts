import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CurrencyRateModule } from '../currency-rates/currency-rate.module';
import { CategoryDefaultMappingsModule } from '../category-default-mappings/category-default-mappings.module';
import { PaymentRequestsController } from './payment-requests.controller';
import { PaymentRequestsService } from './payment-requests.service';

@Module({
  imports: [DatabaseModule, CurrencyRateModule, CategoryDefaultMappingsModule],
  controllers: [PaymentRequestsController],
  providers: [PaymentRequestsService],
  exports: [PaymentRequestsService],
})
export class PaymentRequestsModule {}
