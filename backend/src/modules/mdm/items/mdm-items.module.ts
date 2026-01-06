import { Module } from '@nestjs/common';
import { MdmItemsService } from './mdm-items.service';
import { MdmItemsController } from './mdm-items.controller';

@Module({
  controllers: [MdmItemsController],
  providers: [MdmItemsService],
  exports: [MdmItemsService],
})
export class MdmItemsModule {}




