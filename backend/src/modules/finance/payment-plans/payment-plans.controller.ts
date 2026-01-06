import {
  Body,
  Controller,
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
import { PaymentPlansService } from './payment-plans.service';
import { CreatePaymentPlanDto } from './dto/create-payment-plan.dto';
import { MovePaymentPlanDto } from './dto/move-payment-plan.dto';

@ApiTags('finance/payment-plans')
@Controller('finance/payment-plans')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class PaymentPlansController {
  constructor(private readonly service: PaymentPlansService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create payment plan item (PLANNED)' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreatePaymentPlanDto) {
    return this.service.create({
      paymentRequestId: dto.paymentRequestId,
      fromAccountId: dto.fromAccountId,
      plannedDate: new Date(dto.plannedDate),
      plannedAmount: dto.plannedAmount,
    });
  }

  @Post(':id/move')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move plan (mark MOVED + create new PLANNED)' })
  move(@Param('id') id: string, @Body() dto: MovePaymentPlanDto) {
    return this.service.move({
      planId: id,
      newPlannedDate: new Date(dto.newPlannedDate),
      newFromAccountId: dto.newFromAccountId,
    });
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel plan item' })
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}




