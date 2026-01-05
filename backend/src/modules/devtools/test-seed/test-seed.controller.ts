import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AccountingDocType, Prisma } from '@prisma/client';
import { AccountingEntryService } from '../../finance/accounting-entry/accounting-entry.service';
import { CurrencyRateService } from '../../finance/currency-rates/currency-rate.service';
import { SeedAccountingEntryDto } from './dto/seed-accounting-entry.dto';
import { TestSeedGuard } from './test-seed.guard';

@ApiTags('devtools/test-seed')
@Controller('devtools/test-seed')
@UseGuards(JwtAuthGuard, RolesGuard, TestSeedGuard)
@ApiCookieAuth()
export class TestSeedController {
  constructor(
    private readonly accounting: AccountingEntryService,
    private readonly currencyRates: CurrencyRateService,
  ) {}

  @Post('accounting-entries')
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Seed ledger entry (TEST_SEED only; test/dev only)',
    description:
      'Creates AccountingEntry with docType=TEST_SEED, source=TEST_SEED, and metadata.docLineId for idempotency.',
  })
  async seedAccountingEntry(@Body() dto: SeedAccountingEntryDto) {
    // Validate amountBase against system conversion (prevents bypassing currency rates)
    const postingDate = dto.postingDate
      ? new Date(dto.postingDate)
      : new Date();
    const amount = new Prisma.Decimal(dto.amount);
    const expectedBase = await this.currencyRates.convertToBase({
      amount,
      currency: dto.currency,
      date: postingDate,
    });
    const providedBase = new Prisma.Decimal(dto.amountBase);
    if (!expectedBase.eq(providedBase)) {
      // 422 style is handled by global filter; throw generic error for now
      throw new Error(
        `amountBase mismatch: expected ${expectedBase.toString()} but got ${providedBase.toString()}`,
      );
    }

    const existingCount = await (
      this.accounting as any
    ).prisma.accountingEntry.count({
      where: { docType: AccountingDocType.TEST_SEED, docId: dto.seedId } as any,
    });

    const entry = await this.accounting.createEntry({
      // Do NOT rely on generated enum member at runtime (requires prisma generate).
      docType: 'TEST_SEED' as any,
      docId: dto.seedId,
      legalEntityId: dto.legalEntityId,
      brandId: (dto.brandId as any) ?? undefined,
      countryId: (dto.countryId as any) ?? undefined,
      marketplaceId: (dto.marketplaceId as any) ?? null,
      warehouseId: (dto.warehouseId as any) ?? null,
      lineNumber: existingCount + 1,
      postingDate,
      debitAccount: dto.debitAccount,
      creditAccount: dto.creditAccount,
      amount,
      currency: dto.currency,
      source: 'TEST_SEED',
      metadata: {
        source: 'TEST_SEED',
        docLineId: dto.docLineId,
      },
    } as any);

    return entry;
  }
}
