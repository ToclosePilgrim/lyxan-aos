import { Module } from '@nestjs/common';
import { AccountingEntryModule } from '../../finance/accounting-entry/accounting-entry.module';
import { CurrencyRateModule } from '../../finance/currency-rates/currency-rate.module';
import { TestSeedController } from './test-seed.controller';
import { TestSeedGuard } from './test-seed.guard';

@Module({
  imports: [AccountingEntryModule, CurrencyRateModule],
  controllers: [TestSeedController],
  providers: [TestSeedGuard],
})
export class TestSeedModule {}




