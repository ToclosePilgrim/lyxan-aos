import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CashAccountingLinksController } from './cash-accounting-links.controller';
import { CashAccountingLinksService } from './cash-accounting-links.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CashAccountingLinksController],
  providers: [CashAccountingLinksService],
  exports: [CashAccountingLinksService],
})
export class CashAccountingLinksModule {}




