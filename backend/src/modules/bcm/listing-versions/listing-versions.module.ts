import { Module } from '@nestjs/common';
import { ListingVersionsService } from './listing-versions.service';
import { ListingVersionsController } from './listing-versions.controller';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ListingVersionsController],
  providers: [ListingVersionsService],
  exports: [ListingVersionsService],
})
export class ListingVersionsModule {}

