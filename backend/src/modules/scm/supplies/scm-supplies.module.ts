import { Module } from '@nestjs/common';
import { ScmSuppliesController } from './scm-supplies.controller';
import { ScmSuppliesService } from './scm-supplies.service';
import { DatabaseModule } from '../../../database/database.module';
import { InventoryModule } from '../../inventory/inventory.module';

@Module({
  imports: [DatabaseModule, InventoryModule],
  controllers: [ScmSuppliesController],
  providers: [ScmSuppliesService],
  exports: [ScmSuppliesService],
})
export class ScmSuppliesModule {}

