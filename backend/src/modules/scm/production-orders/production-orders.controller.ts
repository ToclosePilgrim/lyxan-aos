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
  ApiQuery,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ProductionOrdersService } from './production-orders.service';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { CreateProductionOrderItemDto } from './dto/create-production-order-item.dto';
import { UpdateProductionOrderItemDto } from './dto/update-production-order-item.dto';
import { FilterProductionOrdersDto } from './dto/filter-production-orders.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('scm/production-orders')
@Controller('scm/production-orders')
@UseGuards(JwtAuthGuard)
export class ProductionOrdersController {
  constructor(
    private readonly productionOrdersService: ProductionOrdersService,
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
  @ApiOperation({ summary: 'Get production order details with financial documents' })
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
    description: 'Returns detailed cost breakdown with materials, services, and other documents',
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
    description: 'Returns material and services cost breakdown (backward compatibility)',
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

