import { Module } from '@nestjs/common';
import { ScmSuppliesController } from './scm-supplies.controller';
import { ScmSuppliesService } from './scm-supplies.service';
import { DatabaseModule } from '../../../database/database.module';
import { InventoryModule } from '../../inventory/inventory.module';
import { ProvisioningRecalcService } from '../production-orders/provisioning-recalc.service';
import { OsEventsModule } from '../../os-events/os-events.module';
import { MdmItemsModule } from '../../mdm/items/mdm-items.module';
import { MdmOffersModule } from '../../mdm/offers/mdm-offers.module';
import { FinancialDocumentsModule } from '../../finance/documents/financial-documents.module';
import { AccountingEntryModule } from '../../finance/accounting-entry/accounting-entry.module';
import { InventoryAccountingLinkService } from '../../finance/inventory-accounting-link.service';
import { PostingRunsModule } from '../../finance/posting-runs/posting-runs.module';

@Module({
  imports: [
    DatabaseModule,
    InventoryModule,
    MdmItemsModule,
    MdmOffersModule,
    OsEventsModule,
    FinancialDocumentsModule,
    AccountingEntryModule,
    PostingRunsModule,
  ],
  controllers: [ScmSuppliesController],
  providers: [
    ScmSuppliesService,
    ProvisioningRecalcService,
    InventoryAccountingLinkService,
  ],
  exports: [ScmSuppliesService],
})
export class ScmSuppliesModule {}
