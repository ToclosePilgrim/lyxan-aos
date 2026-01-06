import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ScmProductsController } from './scm-products.controller';
import { ScmProductsService } from './scm-products.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ScmProductsController],
  providers: [ScmProductsService],
})
export class ScmProductsModule {}




