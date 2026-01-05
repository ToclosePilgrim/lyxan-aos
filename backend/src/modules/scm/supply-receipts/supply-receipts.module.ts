import { Module } from '@nestjs/common';
import { ScmSuppliesModule } from '../supplies/scm-supplies.module';
import { SupplyReceiptsController } from './supply-receipts.controller';

@Module({
  imports: [ScmSuppliesModule],
  controllers: [SupplyReceiptsController],
})
export class SupplyReceiptsModule {}

