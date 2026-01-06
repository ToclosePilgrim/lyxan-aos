import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { PaymentCalendarService } from './payment-calendar.service';

@ApiTags('finance/payment-calendar')
@Controller('finance/payment-calendar')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class PaymentCalendarController {
  constructor(private readonly service: PaymentCalendarService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Payment calendar (planned outflows) + backlog' })
  async getCalendar(
    @Query('legalEntityId') legalEntityId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('currency') currency?: string,
    @Query('includeBacklog') includeBacklog?: string,
  ) {
    return this.service.getCalendar({
      legalEntityId,
      from: new Date(from),
      to: new Date(to),
      currency: currency || undefined,
      includeBacklog:
        String(includeBacklog ?? 'false').toLowerCase() === 'true',
    });
  }
}




