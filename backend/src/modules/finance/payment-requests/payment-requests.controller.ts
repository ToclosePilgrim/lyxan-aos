import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { PaymentRequestsService } from './payment-requests.service';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { UpdatePaymentRequestDto } from './dto/update-payment-request.dto';
import { ListPaymentRequestsDto } from './dto/list-payment-requests.dto';
import { ApprovePaymentRequestDto } from './dto/approve-payment-request.dto';
import { RejectPaymentRequestDto } from './dto/reject-payment-request.dto';

@ApiTags('finance/payment-requests')
@Controller('finance/payment-requests')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class PaymentRequestsController {
  constructor(private readonly service: PaymentRequestsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create payment request (DRAFT)' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreatePaymentRequestDto) {
    return this.service.create({
      legalEntityId: dto.legalEntityId,
      type: dto.type,
      amount: dto.amount,
      currency: dto.currency,
      plannedPayDate: new Date(dto.plannedPayDate),
      priority: dto.priority,
      counterpartyId: dto.counterpartyId,
      financialDocumentId: dto.financialDocumentId,
      linkedDocType: dto.linkedDocType,
      linkedDocId: dto.linkedDocId,
      cashflowCategoryId: dto.cashflowCategoryId,
      pnlCategoryId: dto.pnlCategoryId,
      description: dto.description,
      attachments: dto.attachments,
    });
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Update payment request (only DRAFT)' })
  update(@Param('id') id: string, @Body() dto: UpdatePaymentRequestDto) {
    return this.service.update(id, dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List payment requests' })
  list(@Query() q: ListPaymentRequestsDto) {
    return this.service.list({
      legalEntityId: q.legalEntityId,
      status: q.status,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get payment request by id' })
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post(':id/submit')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit payment request' })
  submit(@Param('id') id: string) {
    return this.service.submit(id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve payment request' })
  approve(@Param('id') id: string, @Body() dto: ApprovePaymentRequestDto) {
    return this.service.approve(id, {
      approvedBy: dto.approvedBy,
      approverRole: dto.approverRole,
    });
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject payment request' })
  reject(@Param('id') id: string, @Body() dto: RejectPaymentRequestDto) {
    return this.service.reject(id, {
      rejectedBy: dto.rejectedBy,
      reason: dto.reason,
    });
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel payment request' })
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}




