import { Module } from '@nestjs/common';
import { ProductContentVersionsService } from './product-content-versions.service';
import { ProductContentVersionsController } from './product-content-versions.controller';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ProductContentVersionsController],
  providers: [ProductContentVersionsService],
  exports: [ProductContentVersionsService],
})
export class ProductContentVersionsModule {}





