import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrencyRateService } from './currency-rate.service';
import { UpsertCurrencyRateDto } from './dto/upsert-currency-rate.dto';
import { FilterCurrencyRateDto } from './dto/filter-currency-rate.dto';

@ApiTags('finance/currency-rates')
@Controller('finance/currency-rates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CurrencyRateController {
  constructor(private readonly service: CurrencyRateService) {}

  @Get('base-currency')
  @Roles('Admin', 'FinanceManager', 'Manager')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get base currency configured for finance' })
  async baseCurrency() {
    return { baseCurrency: await this.service.getBaseCurrency() };
  }

  @Post()
  @Roles('Admin', 'FinanceManager')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create or update currency rate for a date' })
  upsert(@Body() dto: UpsertCurrencyRateDto) {
    return this.service.upsertRate({
      currency: dto.currency,
      rateDate: new Date(dto.rateDate),
      rateToBase: dto.rateToBase,
      source: dto.source,
    });
  }

  @Get()
  @Roles('Admin', 'FinanceManager', 'Manager')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List currency rates (limited to 1000)' })
  list(@Query() filter: FilterCurrencyRateDto) {
    return this.service.listRates({
      currency: filter.currency,
      fromDate: filter.fromDate ? new Date(filter.fromDate) : undefined,
      toDate: filter.toDate ? new Date(filter.toDate) : undefined,
    });
  }

  @Get(':id')
  @Roles('Admin', 'FinanceManager', 'Manager')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get currency rate by ID' })
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }
}




