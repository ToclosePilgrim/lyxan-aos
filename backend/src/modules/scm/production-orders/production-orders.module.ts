import { Module } from '@nestjs/common';
import { ProductionOrdersController } from './production-orders.controller';
import { ProductionOrdersService } from './production-orders.service';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ProductionOrdersController],
  providers: [ProductionOrdersService],
  exports: [ProductionOrdersService],
})
export class ProductionOrdersModule {}




