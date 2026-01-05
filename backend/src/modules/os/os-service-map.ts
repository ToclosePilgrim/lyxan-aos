import { Type } from '@nestjs/common';
import { ScmSuppliesService } from '../scm/supplies/scm-supplies.service';
import { SalesDocumentsService } from '../finance/sales-documents/sales-documents.service';
import { InventoryReportService } from '../inventory/inventory-report.service';
import { FinancialDocumentsService } from '../finance/documents/financial-documents.service';
import { FinanceService } from '../finance/finance.service';
import { ScmStocksService } from '../scm/stocks/scm-stocks.service';
import { TransfersService } from '../scm/transfers/transfers.service';

export const OS_SERVICE_MAP: Record<string, Type<unknown>> = {
  ScmSuppliesService,
  SalesDocumentsService,
  InventoryReportService,
  FinancialDocumentsService,
  FinanceService,
  ScmStocksService,
  TransfersService,
};
