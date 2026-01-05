import { Module } from '@nestjs/common';
import { MdmOffersService } from './mdm-offers.service';
import { MdmOffersController } from './mdm-offers.controller';

@Module({
  controllers: [MdmOffersController],
  providers: [MdmOffersService],
  exports: [MdmOffersService],
})
export class MdmOffersModule {}

