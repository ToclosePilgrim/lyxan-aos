import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
import { MoneyTransactionsService } from './money-transactions.service';
import { CreateMoneyTransactionDto } from './dto/create-money-transaction.dto';
import { ListMoneyTransactionsDto } from './dto/list-money-transactions.dto';

@ApiTags('finance/money-transactions')
@Controller('finance')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class MoneyTransactionsController {
  constructor(private readonly service: MoneyTransactionsService) {}

  @Post('money-transactions')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create manual money transaction (idempotent)' })
  @ApiResponse({ status: 201, description: 'Created or existing returned' })
  create(@Body() dto: CreateMoneyTransactionDto) {
    return this.service.create({
      accountId: dto.accountId,
      occurredAt: new Date(dto.occurredAt),
      direction: dto.direction,
      amount: dto.amount,
      currency: dto.currency,
      description: dto.description,
      counterpartyId: dto.counterpartyId,
      cashflowCategoryId: dto.cashflowCategoryId,
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
      idempotencyKey: dto.idempotencyKey,
    });
  }

  @Get('financial-accounts/:id/transactions')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List transactions for account' })
  listForAccount(
    @Param('id') accountId: string,
    @Query() query: ListMoneyTransactionsDto,
  ) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    return this.service.listAccountTransactions({ accountId, from, to });
  }

  @Get('financial-accounts/:id/balance')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get account balance at date (optional)' })
  getBalance(@Param('id') accountId: string, @Query('at') at?: string) {
    const atDate = at ? new Date(at) : undefined;
    return this.service.getAccountBalance({ accountId, atDate });
  }
}
