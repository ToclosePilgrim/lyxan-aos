import { Module, forwardRef } from '@nestjs/common';
import { ScmController } from './scm.controller';
import { ScmService } from './scm.service';
import { ScmProductsController } from './scm-products.controller';
import { ScmProductsService } from './scm-products.service';
import { ScmBomController } from './scm-bom.controller';
import { ScmBomService } from './scm-bom.service';
import { ProductionOrdersModule } from './production-orders/production-orders.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { ScmSuppliesModule } from './supplies/scm-supplies.module';
import { ScmStocksModule } from './stocks/scm-stocks.module';
import { ScmServicesModule } from './services/scm-services.module';
import { DatabaseModule } from '../../database/database.module';
import { ListingVersionsModule } from '../bcm/listing-versions/listing-versions.module';
import { ProductContentVersionsModule } from '../bcm/product-content-versions/product-content-versions.module';

@Module({
  imports: [
    DatabaseModule,
    SuppliersModule,
    ProductionOrdersModule,
    WarehousesModule,
    ScmSuppliesModule,
    ScmStocksModule,
    ScmServicesModule,
    forwardRef(() => ListingVersionsModule),
    ProductContentVersionsModule,
  ],
  // ScmProductsController должен быть первым, чтобы его маршруты имели приоритет
  controllers: [ScmProductsController, ScmBomController, ScmController],
  providers: [ScmService, ScmProductsService, ScmBomService],
  exports: [ScmService, ScmProductsService, ScmBomService],
})
export class ScmModule {}

