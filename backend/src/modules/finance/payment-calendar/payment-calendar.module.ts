import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { PaymentCalendarController } from './payment-calendar.controller';
import { PaymentCalendarService } from './payment-calendar.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PaymentCalendarController],
  providers: [PaymentCalendarService],
  exports: [PaymentCalendarService],
})
export class PaymentCalendarModule {}




