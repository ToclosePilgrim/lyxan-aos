import { Module } from '@nestjs/common';
import { BcmController } from './bcm.controller';
import { BcmService } from './bcm.service';
import { ScmModule } from '../scm/scm.module';
import { DatabaseModule } from '../../database/database.module';
import { ListingVersionsModule } from './listing-versions/listing-versions.module';
import { ProductContentVersionsModule } from './product-content-versions/product-content-versions.module';

@Module({
  imports: [DatabaseModule, ScmModule, ListingVersionsModule, ProductContentVersionsModule],
  controllers: [BcmController],
  providers: [BcmService],
  exports: [BcmService],
})
export class BcmModule {}

