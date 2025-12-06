import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { SupplierItemsController } from './supplier-items.controller';
import { SupplierItemsService } from './supplier-items.service';
import { SupplierServicesController } from './supplier-services.controller';
import { SupplierServicesService } from './supplier-services.service';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [
    SuppliersController,
    SupplierItemsController,
    SupplierServicesController,
  ],
  providers: [
    SuppliersService,
    SupplierItemsService,
    SupplierServicesService,
  ],
  exports: [
    SuppliersService,
    SupplierItemsService,
    SupplierServicesService,
  ],
})
export class SuppliersModule {}


