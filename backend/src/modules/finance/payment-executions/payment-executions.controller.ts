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
import { ExecutePaymentPlanDto } from './dto/execute-payment-plan.dto';
import { ListPaymentExecutionsDto } from './dto/list-payment-executions.dto';
import { PaymentExecutionsService } from './payment-executions.service';
import { VoidPaymentExecutionDto } from './dto/void-payment-execution.dto';
import { RepostPaymentExecutionDto } from './dto/repost-payment-execution.dto';

@ApiTags('finance/payment-executions')
@Controller('finance')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class PaymentExecutionsController {
  constructor(private readonly service: PaymentExecutionsService) {}

  @Post('payment-plans/:id/execute')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Execute payment plan (creates execution + moneyTx + entry + link)',
  })
  execute(@Param('id') planId: string, @Body() dto: ExecutePaymentPlanDto) {
    return this.service.executePlan({
      paymentPlanId: planId,
      fromAccountId: dto.fromAccountId,
      executedAt: dto.executedAt ? new Date(dto.executedAt) : undefined,
      bankReference: dto.bankReference,
      description: dto.description,
    });
  }

  @Get('payment-executions')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List payment executions' })
  list(@Query() q: ListPaymentExecutionsDto) {
    return this.service.list({
      legalEntityId: q.legalEntityId,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });
  }

  @Post('payment-executions/:id/void')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Void payment execution (void moneyTx + create reversal entries)',
  })
  void(@Param('id') id: string, @Body() dto: VoidPaymentExecutionDto) {
    return this.service.voidExecution({ id, reason: dto.reason });
  }

  @Post('payment-executions/:id/repost')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Repost payment execution (void existing if needed, create a new plan + execution + moneyTx + postingRun)',
  })
  repost(@Param('id') id: string, @Body() dto: RepostPaymentExecutionDto) {
    return this.service.repostExecution({ id, reason: dto.reason });
  }
}
