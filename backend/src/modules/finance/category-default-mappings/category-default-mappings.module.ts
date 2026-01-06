import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CategoryDefaultMappingsController } from './category-default-mappings.controller';
import { CategoryDefaultMappingsService } from './category-default-mappings.service';
import { FinanceCategoryResolverService } from './category-resolver.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CategoryDefaultMappingsController],
  providers: [CategoryDefaultMappingsService, FinanceCategoryResolverService],
  exports: [CategoryDefaultMappingsService, FinanceCategoryResolverService],
})
export class CategoryDefaultMappingsModule {}




