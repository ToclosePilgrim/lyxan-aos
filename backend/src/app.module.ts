import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ScmSuppliesModule } from './modules/scm/supplies/scm-supplies.module';
import { ProductionOrdersModule } from './modules/scm/production-orders/production-orders.module';
import { FinanceModule } from './modules/finance/finance.module';
import { CounterpartiesModule } from './modules/mdm/counterparties/counterparties.module';
import { CounterpartyOffersModule } from './modules/mdm/counterparty-offers/counterparty-offers.module';
import { CountriesModule } from './modules/mdm/countries/countries.module';
import { LegalEntitiesModule } from './modules/mdm/legal-entities/legal-entities.module';
import { BrandsModule } from './modules/mdm/brands/brands.module';
import { MarketplacesModule } from './modules/mdm/marketplaces/marketplaces.module';
import { ScmProductsModule } from './modules/scm/scm-products.module';
import { WarehousesModule } from './modules/scm/warehouses/warehouses.module';
import { SupplyReceiptsModule } from './modules/scm/supply-receipts/supply-receipts.module';
import { ProductionConsumptionsModule } from './modules/scm/production-consumptions/production-consumptions.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    InventoryModule,
    FinanceModule,
    CountriesModule,
    LegalEntitiesModule,
    BrandsModule,
    MarketplacesModule,
    CounterpartiesModule,
    CounterpartyOffersModule,
    ScmProductsModule,
    ScmSuppliesModule,
    ProductionOrdersModule,
    WarehousesModule,
    SupplyReceiptsModule,
    ProductionConsumptionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
