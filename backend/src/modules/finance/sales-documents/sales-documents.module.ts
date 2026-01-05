import { Module } from '@nestjs/common';
import { SalesDocumentsService } from './sales-documents.service';
import { SalesDocumentsController } from './sales-documents.controller';
import { CurrencyRateModule } from '../currency-rates/currency-rate.module';
import { AccountingEntryModule } from '../accounting-entry/accounting-entry.module';
import { OsEventsModule } from '../../os-events/os-events.module';
import { InventoryModule } from '../../inventory/inventory.module';
import { InventoryAccountingLinkService } from '../inventory-accounting-link.service';
import { MdmItemsModule } from '../../mdm/items/mdm-items.module';
import { PostingRunsModule } from '../posting-runs/posting-runs.module';

@Module({
  imports: [
    CurrencyRateModule,
    AccountingEntryModule,
    OsEventsModule,
    InventoryModule,
    MdmItemsModule,
    PostingRunsModule,
  ],
  providers: [SalesDocumentsService, InventoryAccountingLinkService],
  controllers: [SalesDocumentsController],
  exports: [SalesDocumentsService],
})
export class SalesDocumentsModule {}
