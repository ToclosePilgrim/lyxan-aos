import { Module } from '@nestjs/common';
import { CounterpartyOffersController } from './counterparty-offers.controller';
import { CounterpartyOffersService } from './counterparty-offers.service';
import { MdmItemsModule } from '../items/mdm-items.module';

@Module({
  imports: [MdmItemsModule],
  controllers: [CounterpartyOffersController],
  providers: [CounterpartyOffersService],
  exports: [CounterpartyOffersService],
})
export class CounterpartyOffersModule {}




