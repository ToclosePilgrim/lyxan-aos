import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CurrencyRateModule } from '../currency-rates/currency-rate.module';
import { AccountingEntryService } from './accounting-entry.service';
import { AccountingEntryController } from './accounting-entry.controller';
import { AccountingValidationService } from '../accounting-validation.service';

@Module({
  imports: [DatabaseModule, CurrencyRateModule],
  controllers: [AccountingEntryController],
  providers: [AccountingEntryService, AccountingValidationService],
  exports: [AccountingEntryService, AccountingValidationService],
})
export class AccountingEntryModule {}
