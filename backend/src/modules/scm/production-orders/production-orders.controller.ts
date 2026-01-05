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
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ProductionOrdersService } from './production-orders.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { CreateProductionOrderItemDto } from './dto/create-production-order-item.dto';
import { UpdateProductionOrderItemDto } from './dto/update-production-order-item.dto';
import { FilterProductionOrdersDto } from './dto/filter-production-orders.dto';
import { CreateProductionOrderServiceDto } from './dto/create-production-order-service.dto';
import { UpdateProductionOrderComponentSourceDto } from './dto/update-production-order-component-source.dto';
import { ConsumeComponentsDto } from './dto/consume-components.dto';
import { ConsumeOneDto } from './dto/consume-one.dto';
import { ProvisionProductionOrderItemDto } from './dto/provision-production-order-item.dto';
import { VoidProductionCompletionDto } from './dto/void-production-completion.dto';
import { RepostProductionCompletionDto } from './dto/repost-production-completion.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ProductionConsumptionService } from './production-consumption.service';

@ApiTags('scm/production-orders')
@Controller('scm/production-orders')
@UseGuards(JwtAuthGuard)
export class ProductionOrdersController {
  constructor(
    private readonly productionOrdersService: ProductionOrdersService,
    private readonly productionConsumptionService: ProductionConsumptionService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get list of production orders' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (can be multiple, comma-separated)',
  })
  @ApiQuery({
    name: 'productId',
    required: false,
    description: 'Filter by product ID',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Filter by date from',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Filter by date to',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by code or name',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: 'Page size',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Limit number of results (will be clamped to 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of production orders',
  })
  @ApiCookieAuth()
  async findAll(@Query() filters?: FilterProductionOrdersDto) {
    // Parse status if it's a string (comma-separated)
    if (filters?.status && typeof filters.status === 'string') {
      filters.status = filters.status.split(',') as any;
    }
    return this.productionOrdersService.findAll(filters);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get production order details' })
  @ApiParam({ name: 'id', description: 'Production Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Production order details with items',
  })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @ApiCookieAuth()
  async findOne(@Param('id') id: string) {
    return this.productionOrdersService.findOne(id);
  }

  @Get(':id/with-finance')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Get production order details with financial documents',
  })
  @ApiParam({ name: 'id', description: 'Production Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Production order details with financial documents',
  })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @ApiCookieAuth()
  async findOneWithFinance(@Param('id') id: string) {
    return this.productionOrdersService.findOneWithFinance(id);
  }

  @Get(':id/preview-with-finance')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Get production order preview with aggregated financial data',
  })
  @ApiParam({ name: 'id', description: 'Production Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Production order preview with aggregated financial data',
  })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @ApiCookieAuth()
  async previewWithFinance(@Param('id') id: string) {
    return this.productionOrdersService.previewWithFinance(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new production order (Admin only)',
    description:
      'Creates order and automatically generates items from BOM if available',
  })
  @ApiResponse({
    status: 201,
    description: 'The production order has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiCookieAuth()
  async create(@Body() createDto: CreateProductionOrderDto) {
    return this.productionOrdersService.create(createDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update production order (Admin only)' })
  @ApiParam({ name: 'id', description: 'Production Order ID' })
  @ApiResponse({
    status: 200,
    description: 'The production order has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @ApiCookieAuth()
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateProductionOrderDto,
  ) {
    return this.productionOrdersService.update(id, updateDto);
  }

  @Post(':orderId/items')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a component item to production order (Admin only)',
    description: 'Adds a component that is not in BOM',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiResponse({
    status: 201,
    description: 'The item has been successfully added.',
  })
  @ApiResponse({ status: 404, description: 'Order or supplier item not found' })
  @ApiCookieAuth()
  async createItem(
    @Param('orderId') orderId: string,
    @Body() createDto: CreateProductionOrderItemDto,
  ) {
    return this.productionOrdersService.createItem(orderId, createDto);
  }

  @Patch(':orderId/items/:itemId')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({
    summary: 'Update production order item (Admin only)',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  @ApiResponse({
    status: 200,
    description: 'The item has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Order or item not found' })
  @ApiCookieAuth()
  async updateItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() updateDto: UpdateProductionOrderItemDto,
  ) {
    return this.productionOrdersService.updateItem(orderId, itemId, updateDto);
  }

  @Delete(':orderId/items/:itemId')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete production order item (Admin only)',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  @ApiResponse({
    status: 200,
    description: 'The item has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Order or item not found' })
  @ApiCookieAuth()
  async deleteItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.productionOrdersService.deleteItem(orderId, itemId);
  }

  @Patch(':orderId/items/:itemId/source')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Update component source for a production order item',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiParam({ name: 'itemId', description: 'Production Order Item ID' })
  @ApiResponse({
    status: 200,
    description: 'The component source has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Order or item not found' })
  @ApiCookieAuth()
  async updateComponentSource(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateProductionOrderComponentSourceDto,
  ) {
    return this.productionOrdersService.updateComponentSource(
      orderId,
      itemId,
      dto,
    );
  }

  @Post(':orderId/items/:itemId/provision')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Provision a component for production order (MVP)',
    description:
      'Validates stock availability (unless allowNegativeStock=true) and marks component as PROVIDED/PARTIALLY_PROVIDED.',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiParam({ name: 'itemId', description: 'Production Order Item ID' })
  @ApiCookieAuth()
  async provisionItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ProvisionProductionOrderItemDto,
  ) {
    return this.productionOrdersService.provisionItem(orderId, itemId, dto);
  }

  @Post(':orderId/items/:itemId/unprovision')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unprovision a component for production order (MVP)',
    description:
      'Resets provisioning flags. Forbidden if consumption already started.',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiParam({ name: 'itemId', description: 'Production Order Item ID' })
  @ApiCookieAuth()
  async unprovisionItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.productionOrdersService.unprovisionItem(orderId, itemId);
  }

  @Get(':id/services')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get services for a production order' })
  @ApiParam({ name: 'id', description: 'Production Order ID' })
  @ApiResponse({
    status: 200,
    description: 'List of services for the production order',
  })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @ApiCookieAuth()
  async getServices(@Param('id') id: string) {
    return this.productionOrdersService.getServices(id);
  }

  @Post(':id/services')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a service to a production order (Admin only)' })
  @ApiParam({ name: 'id', description: 'Production Order ID' })
  @ApiResponse({
    status: 201,
    description:
      'The service has been successfully added to the production order.',
  })
  @ApiResponse({
    status: 404,
    description: 'Production order or supplier not found',
  })
  @ApiCookieAuth()
  async addService(
    @Param('id') id: string,
    @Body() dto: CreateProductionOrderServiceDto,
  ) {
    return this.productionOrdersService.addService(id, dto);
  }

  @Delete(':id/services/:serviceId')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a service from a production order (Admin only)',
  })
  @ApiParam({ name: 'id', description: 'Production Order ID' })
  @ApiParam({ name: 'serviceId', description: 'Service ID' })
  @ApiResponse({
    status: 200,
    description: 'The service has been successfully deleted.',
  })
  @ApiResponse({
    status: 404,
    description: 'Service not found for production order',
  })
  @ApiCookieAuth()
  async deleteService(
    @Param('id') id: string,
    @Param('serviceId') serviceId: string,
  ) {
    return this.productionOrdersService.deleteService(id, serviceId);
  }

  @Post(':orderId/generate-procurement')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Generate supply/transfer documents for production order components',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Procurement generation result',
  })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @ApiCookieAuth()
  async generateProcurement(@Param('orderId') orderId: string) {
    return this.productionOrdersService.generateProcurementForComponents(
      orderId,
    );
  }

  @Post(':orderId/start')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Start production order: consume OWN_STOCK components via FIFO and set status IN_PROGRESS',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Production started; components consumed',
  })
  @ApiResponse({
    status: 422,
    description: 'Components are not fully provided or insufficient stock',
  })
  @ApiCookieAuth()
  async startProduction(@Param('orderId') orderId: string) {
    return this.productionOrdersService.startProduction(orderId);
  }

  @Post(':orderId/recalculate-provision-status')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recalculate provisioning status for production order components',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Provisioning status recalculated',
  })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @ApiCookieAuth()
  async recalcProvisionStatus(@Param('orderId') orderId: string) {
    return this.productionOrdersService.recalculateProvisionStatusForOrder(
      orderId,
    );
  }

  @Post(':orderId/consume-components')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Consume components for a production order (creates PRODUCTION_INPUT movements)',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiCookieAuth()
  async consumeComponents(
    @Param('orderId') orderId: string,
    @Body() dto: ConsumeComponentsDto,
  ) {
    return this.productionOrdersService.consumeComponents(orderId, dto);
  }

  @Get(':orderId/reservations')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get stock reservations summary for a production order',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiCookieAuth()
  async getReservations(@Param('orderId') orderId: string) {
    return this.productionOrdersService.getReservations(orderId);
  }

  @Post(':orderId/auto-consume')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Auto-consume all remaining provided components (atomic, uses consumption operations)',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiCookieAuth()
  async autoConsume(@Param('orderId') orderId: string, @Req() req: any) {
    const userId = req?.user?.id ?? null;
    return this.productionConsumptionService.autoConsumeRemaining(
      orderId,
      userId,
    );
  }

  @Post(':orderId/items/:itemId/consume')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Consume a single component (creates a Consumption Operation and PRODUCTION_INPUT movements)',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiParam({ name: 'itemId', description: 'Production Order Item ID' })
  @ApiCookieAuth()
  async consumeSingleItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ConsumeOneDto,
    @Req() req: any,
  ) {
    const userId = req?.user?.id ?? null;
    return this.productionConsumptionService.consume({
      orderId,
      itemId,
      quantity: dto.quantity,
      note: dto.note,
      responsibleUserId: userId,
    });
  }

  @Get(':orderId/consumption-history')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get consumption operations history for a production order',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiCookieAuth()
  async getConsumptionHistory(@Param('orderId') orderId: string) {
    return this.productionConsumptionService.getHistory(orderId);
  }

  @Post(':orderId/complete')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Complete production order and calculate production cost (materials + services)',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Production order completed and costs calculated',
  })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @ApiCookieAuth()
  async completeOrder(@Param('orderId') orderId: string) {
    return this.productionOrdersService.completeProductionOrder(orderId);
  }

  @Post(':orderId/void-completion')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Void production completion posting via PostingRun (reversal entries)',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiCookieAuth()
  async voidCompletion(
    @Param('orderId') orderId: string,
    @Body() dto: VoidProductionCompletionDto,
  ) {
    return (this.productionOrdersService as any).voidCompletionPosting(
      orderId,
      dto.reason,
    );
  }

  @Post(':orderId/repost-completion')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Repost production completion (void current run if needed, then post as next version)',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiCookieAuth()
  async repostCompletion(
    @Param('orderId') orderId: string,
    @Body() dto: RepostProductionCompletionDto,
  ) {
    return (this.productionOrdersService as any).repostCompletionPosting(
      orderId,
      dto.reason,
    );
  }

  @Get(':orderId/cost-breakdown')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get detailed cost breakdown for a production order',
  })
  @ApiParam({ name: 'orderId', description: 'Production Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Cost breakdown returned',
  })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @ApiCookieAuth()
  async costBreakdown(@Param('orderId') orderId: string) {
    return this.productionOrdersService.getCostBreakdown(orderId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete production order (Admin only)' })
  @ApiParam({ name: 'id', description: 'Production Order ID' })
  @ApiResponse({
    status: 200,
    description: 'The production order has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @ApiCookieAuth()
  async remove(@Param('id') id: string) {
    return this.productionOrdersService.remove(id);
  }

  @Get(':id/cost')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Get production order cost breakdown',
    description:
      'Returns detailed cost breakdown with materials, services, and other documents',
  })
  @ApiParam({ name: 'id', description: 'Production Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Cost breakdown with materials, services, and other documents',
  })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @ApiCookieAuth()
  async getCost(@Param('id') id: string) {
    return this.productionOrdersService.getCostBreakdown(id);
  }

  @Get(':id/cost-summary')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({
    summary: 'Get production order cost summary (legacy)',
    description:
      'Returns material and services cost breakdown (backward compatibility)',
  })
  @ApiParam({ name: 'id', description: 'Production Order ID' })
  @ApiResponse({
    status: 200,
    description: 'Cost summary with materials and services',
  })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @ApiCookieAuth()
  async getCostSummary(@Param('id') id: string) {
    return this.productionOrdersService.getCostSummary(id);
  }
}
