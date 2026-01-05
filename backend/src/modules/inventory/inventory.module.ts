import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { FifoInventoryService } from './fifo.service';
import { InventoryOrchestratorService } from './inventory-orchestrator.service';
import { InventoryEventsService } from './inventory-events.service';
import { InventoryReportService } from './inventory-report.service';
import { OsEventsModule } from '../os-events/os-events.module';
import { InventoryReportController } from './inventory-report.controller';
import { InventoryController } from './inventory.controller';
import { DatabaseModule } from '../../database/database.module';
import { CurrencyRateModule } from '../finance/currency-rates/currency-rate.module';
import { InventoryAccountingLinkWriterService } from './inventory-accounting-link-writer.service';
import { StockReservationService } from './stock-reservation.service';

@Module({
  imports: [DatabaseModule, CurrencyRateModule, OsEventsModule],
  providers: [
    InventoryService,
    FifoInventoryService,
    InventoryOrchestratorService,
    InventoryReportService,
    InventoryEventsService,
    InventoryAccountingLinkWriterService,
    StockReservationService,
  ],
  controllers: [InventoryController, InventoryReportController],
  exports: [
    InventoryService,
    FifoInventoryService,
    InventoryOrchestratorService,
    InventoryReportService,
    InventoryEventsService,
    InventoryAccountingLinkWriterService,
    StockReservationService,
  ],
})
export class InventoryModule {}
