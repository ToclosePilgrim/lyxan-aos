import { Module } from '@nestjs/common';
import { OsScmController } from './os-scm.controller';
import { OsInventoryController } from './os-inventory.controller';
import { OsFinanceController } from './os-finance.controller';
import { OsDwhController } from './os-dwh.controller';
import { OsRouterController } from './os-router.controller';
import { OsRouterService } from './os-router.service';
import { FinanceModule } from '../finance/finance.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ScmSuppliesModule } from '../scm/supplies/scm-supplies.module';
import { SalesDocumentsModule } from '../finance/sales-documents/sales-documents.module';
import { PrismaService } from '../../database/prisma.service';
import { OsRegistryModule } from '../os-registry/os-registry.module';

@Module({
  imports: [
    FinanceModule,
    InventoryModule,
    ScmSuppliesModule,
    SalesDocumentsModule,
    OsRegistryModule,
  ],
  controllers: [
    OsScmController,
    OsInventoryController,
    OsFinanceController,
    OsDwhController,
    OsRouterController,
  ],
  providers: [PrismaService, OsRouterService],
})
export class OsApiModule {}
