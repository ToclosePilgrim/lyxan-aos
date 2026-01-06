import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { FinancialDocumentsService } from './financial-documents.service';
import { CreateFinancialDocumentDto } from './dto/create-financial-document.dto';
import { UpdateFinancialDocumentDto } from './dto/update-financial-document.dto';
import { FinancialDocumentFiltersDto } from './dto/financial-document-filters.dto';
import { AttachServiceDto } from './dto/attach-service.dto';
import { CreateFinancePaymentDto } from './dto/create-finance-payment.dto';
import { BatchAccrueFinancialDocumentsDto } from './dto/batch-accrue-financial-documents.dto';
import { VoidAccrualDto } from './dto/void-accrual.dto';
import { FromSupplyReceiptDto } from './dto/from-supply-receipt.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Idempotency } from '../../../common/idempotency/idempotency.decorator';

@ApiTags('finance/documents')
@Controller('finance/documents')
@UseGuards(JwtAuthGuard)
export class FinancialDocumentsController {
  constructor(
    private readonly financialDocumentsService: FinancialDocumentsService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Get list of financial documents with filters and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'List of financial documents with total count',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array' },
        total: { type: 'number' },
      },
    },
  })
  @ApiCookieAuth()
  async findAll(@Query() filters?: FinancialDocumentFiltersDto) {
    return this.financialDocumentsService.findAll(filters);
  }

  @Get('supply/:supplyId')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'List financial documents linked to a supply' })
  @ApiParam({ name: 'supplyId', description: 'SCM Supply ID' })
  @ApiCookieAuth()
  async listForSupply(@Param('supplyId') supplyId: string) {
    return this.financialDocumentsService.findAll({
      scmSupplyId: supplyId,
      limit: 100,
    });
  }

  @Get('production/:orderId')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'List financial documents linked to a production order',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiCookieAuth()
  async listForProduction(@Param('orderId') orderId: string) {
    return this.financialDocumentsService.findAll({
      productionOrderId: orderId,
      limit: 100,
    });
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get financial document details' })
  @ApiParam({ name: 'id', description: 'Financial Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Financial document details with services',
  })
  @ApiResponse({ status: 404, description: 'Financial document not found' })
  @ApiCookieAuth()
  async findOne(@Param('id') id: string) {
    return this.financialDocumentsService.findOne(id);
  }

  @Post()
  @Idempotency({ required: true })
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new financial document (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'The financial document has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Related entity not found' })
  @ApiCookieAuth()
  async create(@Body() createDto: CreateFinancialDocumentDto) {
    return this.financialDocumentsService.create(createDto);
  }

  @Post('from-supply/:supplyId')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create financial document linked to supply' })
  @ApiParam({ name: 'supplyId', description: 'SCM Supply ID' })
  @ApiResponse({
    status: 201,
    description: 'Financial document created for supply',
  })
  @ApiCookieAuth()
  async createFromSupply(
    @Param('supplyId') supplyId: string,
    @Body() createDto: CreateFinancialDocumentDto,
  ) {
    return this.financialDocumentsService.createFromSupply(supplyId, createDto);
  }

  @Post('from-supply-receipt')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create SUPPLY_INVOICE financial document linked to SCM SupplyReceipt',
  })
  @ApiResponse({
    status: 201,
    description: 'Financial document created (idempotent)',
  })
  @ApiCookieAuth()
  async createFromSupplyReceipt(@Body() dto: FromSupplyReceiptDto) {
    return this.financialDocumentsService.createFromSupplyReceipt(dto);
  }

  @Post('from-production-order/:orderId')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create financial document linked to production order',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiResponse({
    status: 201,
    description: 'Financial document created for production order',
  })
  @ApiCookieAuth()
  async createFromProductionOrder(
    @Param('orderId') orderId: string,
    @Body() createDto: CreateFinancialDocumentDto,
  ) {
    return this.financialDocumentsService.createFromProductionOrder(
      orderId,
      createDto,
    );
  }

  // Alias for specification wording
  @Post('from-production/:orderId')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create financial document for production order (alias)',
  })
  @ApiCookieAuth()
  async createFromProduction(
    @Param('orderId') orderId: string,
    @Body() createDto: CreateFinancialDocumentDto,
  ) {
    return this.financialDocumentsService.createFromProductionOrder(
      orderId,
      createDto,
    );
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update financial document (Admin only)' })
  @ApiParam({ name: 'id', description: 'Financial Document ID' })
  @ApiResponse({
    status: 200,
    description: 'The financial document has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Financial document not found' })
  @ApiCookieAuth()
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateFinancialDocumentDto,
  ) {
    return this.financialDocumentsService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete financial document (Admin only)' })
  @ApiParam({ name: 'id', description: 'Financial Document ID' })
  @ApiResponse({
    status: 200,
    description: 'The financial document has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Financial document not found' })
  @ApiCookieAuth()
  async remove(@Param('id') id: string) {
    return this.financialDocumentsService.remove(id);
  }

  @Post(':id/attach-service')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Attach service operations to document (Admin only)',
  })
  @ApiParam({ name: 'id', description: 'Financial Document ID' })
  @ApiResponse({
    status: 200,
    description: 'Services have been successfully attached.',
  })
  @ApiResponse({ status: 404, description: 'Document or service not found' })
  @ApiCookieAuth()
  async attachService(
    @Param('id') id: string,
    @Body() attachDto: AttachServiceDto,
  ) {
    return this.financialDocumentsService.attachService(id, attachDto);
  }

  @Post(':id/payments')
  @Idempotency({ required: true })
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add payment to financial document' })
  @ApiParam({ name: 'id', description: 'Financial Document ID' })
  @ApiResponse({
    status: 201,
    description: 'Payment created and status recalculated',
  })
  @ApiCookieAuth()
  async addPayment(
    @Param('id') id: string,
    @Body() dto: CreateFinancePaymentDto,
  ) {
    return this.financialDocumentsService.addPayment(id, dto);
  }

  @Post(':id/accrue')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Accrue financial document (create AP accrual entry from document)',
  })
  @ApiParam({ name: 'id', description: 'Financial Document ID' })
  @ApiCookieAuth()
  accrue(@Param('id') id: string) {
    return this.financialDocumentsService.accrueDocument({ id });
  }

  @Post(':id/void-accrual')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Void financial document accrual (creates reversal entries)',
  })
  @ApiCookieAuth()
  voidAccrual(@Param('id') id: string, @Body() dto: VoidAccrualDto) {
    return this.financialDocumentsService.voidAccrual({
      id,
      reason: dto.reason,
    });
  }

  @Post('accrue')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Batch accrue financial documents (filters + limit)',
  })
  @ApiCookieAuth()
  batchAccrue(@Body() dto: BatchAccrueFinancialDocumentsDto) {
    return this.financialDocumentsService.batchAccrue({
      legalEntityId: dto.legalEntityId,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      limit: dto.limit,
    });
  }

  @Get(':id/payments')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Get payments for financial document with aggregates',
  })
  @ApiParam({ name: 'id', description: 'Financial Document ID' })
  @ApiResponse({ status: 200, description: 'Payments list with totals' })
  @ApiCookieAuth()
  async getPayments(@Param('id') id: string) {
    return this.financialDocumentsService.getPayments(id);
  }
}
