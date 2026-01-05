import { Module } from '@nestjs/common';
import { AdvertisingController } from './advertising.controller';
import { AdvertisingService } from './advertising.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AdvertisingController],
  providers: [AdvertisingService],
  exports: [AdvertisingService],
})
export class AdvertisingModule {}
