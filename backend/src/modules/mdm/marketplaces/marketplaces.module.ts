import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { MarketplacesController } from './marketplaces.controller';
import { MarketplacesService } from './marketplaces.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MarketplacesController],
  providers: [MarketplacesService],
  exports: [MarketplacesService],
})
export class MarketplacesModule {}

