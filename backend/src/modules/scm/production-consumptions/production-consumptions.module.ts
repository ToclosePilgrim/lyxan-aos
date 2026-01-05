import { Module } from '@nestjs/common';
import { ProductionOrdersModule } from '../production-orders/production-orders.module';
import { ProductionConsumptionsController } from './production-consumptions.controller';

@Module({
  imports: [ProductionOrdersModule],
  controllers: [ProductionConsumptionsController],
})
export class ProductionConsumptionsModule {}

