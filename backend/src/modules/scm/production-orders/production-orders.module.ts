import { Module } from '@nestjs/common';
import { ProductionOrdersController } from './production-orders.controller';
import { ProductionOrdersService } from './production-orders.service';
import { DatabaseModule } from '../../../database/database.module';
import { InventoryModule } from '../../inventory/inventory.module';
import { AccountingEntryModule } from '../../finance/accounting-entry/accounting-entry.module';
import { MdmItemsModule } from '../../mdm/items/mdm-items.module';
import { ProductionConsumptionService } from './production-consumption.service';
import { ProvisioningRecalcService } from './provisioning-recalc.service';
import { FinancialDocumentsModule } from '../../finance/documents/financial-documents.module';
import { OverheadRulesModule } from '../../finance/overhead-rules/overhead-rules.module';
import { CurrencyRateModule } from '../../finance/currency-rates/currency-rate.module';
import { PostingRunsModule } from '../../finance/posting-runs/posting-runs.module';

@Module({
  imports: [
    DatabaseModule,
    InventoryModule,
    AccountingEntryModule,
    CurrencyRateModule,
    FinancialDocumentsModule,
    OverheadRulesModule,
    MdmItemsModule,
    PostingRunsModule,
  ],
  controllers: [ProductionOrdersController],
  providers: [
    ProductionOrdersService,
    ProductionConsumptionService,
    ProvisioningRecalcService,
  ],
  exports: [ProductionOrdersService, ProductionConsumptionService],
})
export class ProductionOrdersModule {}
