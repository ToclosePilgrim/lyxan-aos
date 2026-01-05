import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CashAccountingLinksService } from './cash-accounting-links.service';
import { CreateCashAccountingLinkDto } from './dto/create-cash-accounting-link.dto';

@ApiTags('finance/cash-links')
@Controller('finance')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class CashAccountingLinksController {
  constructor(private readonly service: CashAccountingLinksService) {}

  @Post('cash-links')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create cash accounting link (idempotent)' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateCashAccountingLinkDto) {
    return this.service.link({
      moneyTransactionId: dto.moneyTransactionId,
      accountingEntryId: dto.accountingEntryId,
      role: dto.role,
    });
  }

  @Get('money-transactions/:id/cash-links')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List cash links for a money transaction' })
  listByMoneyTx(@Param('id') moneyTransactionId: string) {
    return this.service.listByMoneyTransaction(moneyTransactionId);
  }

  @Get('accounting-entries/:id/cash-links')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List cash links for an accounting entry' })
  listByEntry(@Param('id') accountingEntryId: string) {
    return this.service.listByAccountingEntry(accountingEntryId);
  }
}
