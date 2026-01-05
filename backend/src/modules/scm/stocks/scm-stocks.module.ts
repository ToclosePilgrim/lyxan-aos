import { Module } from '@nestjs/common';
import { ScmStocksController } from './scm-stocks.controller';
import { ScmStocksService } from './scm-stocks.service';
import { ScmStockBatchesController } from './scm-stock-batches.controller';
import { DatabaseModule } from '../../../database/database.module';
import { InventoryModule } from '../../inventory/inventory.module';
import { FinanceModule } from '../../finance/finance.module';

@Module({
  imports: [DatabaseModule, InventoryModule, FinanceModule],
  controllers: [ScmStocksController, ScmStockBatchesController],
  providers: [ScmStocksService],
  exports: [ScmStocksService],
})
export class ScmStocksModule {}
