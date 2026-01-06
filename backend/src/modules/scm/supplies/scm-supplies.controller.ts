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
import { ScmSuppliesService } from './scm-supplies.service';
import { CreateScmSupplyDto } from './dto/create-scm-supply.dto';
import { UpdateScmSupplyDto } from './dto/update-scm-supply.dto';
import { UpdateScmSupplyStatusDto } from './dto/update-scm-supply-status.dto';
import { CreateScmSupplyItemDto } from './dto/create-scm-supply-item.dto';
import { UpdateScmSupplyItemDto } from './dto/update-scm-supply-item.dto';
import { FilterScmSuppliesDto } from './dto/filter-scm-supplies.dto';
import { ConfirmSupplyReceiveDto } from './dto/confirm-receive.dto';
import { PartialSupplyReceiveDto } from './dto/partial-receive.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Idempotency } from '../../../common/idempotency/idempotency.decorator';
import { ScmSupplyStatus } from '@prisma/client';

@ApiTags('scm/supplies')
@Controller('scm/supplies')
@UseGuards(JwtAuthGuard)
export class ScmSuppliesController {
  constructor(private readonly scmSuppliesService: ScmSuppliesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get list of supplies' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'supplierCounterpartyId', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'productionOrderId', required: false })
  @ApiResponse({ status: 200, description: 'List of supplies' })
  @ApiCookieAuth()
  async findAll(@Query() filters?: FilterScmSuppliesDto) {
    return this.scmSuppliesService.findAll(filters);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get supply details' })
  @ApiParam({ name: 'id', description: 'Supply ID' })
  @ApiResponse({ status: 200, description: 'Supply details with items' })
  @ApiResponse({ status: 404, description: 'Supply not found' })
  @ApiCookieAuth()
  async findOne(@Param('id') id: string) {
    return this.scmSuppliesService.findOne(id);
  }

  @Get(':id/with-finance')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get supply details with financial documents' })
  @ApiParam({ name: 'id', description: 'Supply ID' })
  @ApiResponse({
    status: 200,
    description: 'Supply details with financial documents',
  })
  @ApiResponse({ status: 404, description: 'Supply not found' })
  @ApiCookieAuth()
  async findOneWithFinance(@Param('id') id: string) {
    return this.scmSuppliesService.findOneWithFinance(id);
  }

  @Get(':id/items')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get supply items' })
  @ApiParam({ name: 'id', description: 'Supply ID' })
  @ApiResponse({ status: 200, description: 'List of supply items' })
  @ApiResponse({ status: 404, description: 'Supply not found' })
  @ApiCookieAuth()
  async findItems(@Param('id') supplyId: string) {
    return this.scmSuppliesService.findItems(supplyId);
  }

  @Post()
  @Idempotency({ required: true })
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new supply (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'The supply has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Supplier or warehouse not found' })
  @ApiCookieAuth()
  async create(@Body() createDto: CreateScmSupplyDto) {
    return this.scmSuppliesService.create(createDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update supply (Admin only)' })
  @ApiParam({ name: 'id', description: 'Supply ID' })
  @ApiResponse({
    status: 200,
    description: 'The supply has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Supply not found' })
  @ApiCookieAuth()
  async update(@Param('id') id: string, @Body() updateDto: UpdateScmSupplyDto) {
    return this.scmSuppliesService.update(id, updateDto);
  }

  @Post(':id/transition')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transition supply status via state machine' })
  @ApiParam({ name: 'id', description: 'Supply ID' })
  @ApiResponse({ status: 200, description: 'Supply status updated' })
  @ApiResponse({ status: 400, description: 'Invalid transition' })
  @ApiResponse({ status: 404, description: 'Supply not found' })
  @ApiCookieAuth()
  async transition(
    @Param('id') id: string,
    @Body() body: { targetStatus: ScmSupplyStatus; reason?: string },
  ) {
    return this.scmSuppliesService.transitionStatus(id, body.targetStatus, {
      reason: body.reason,
    });
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({
    summary: 'Change supply status (Admin only)',
    description:
      'Changes status and updates stock/ProductionOrderItem when receiving supply',
  })
  @ApiParam({ name: 'id', description: 'Supply ID' })
  @ApiResponse({
    status: 200,
    description: 'The supply status has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Supply not found' })
  @ApiCookieAuth()
  async changeStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateScmSupplyStatusDto,
  ) {
    return this.scmSuppliesService.changeStatus(id, updateDto);
  }

  @Post(':id/receive-partial')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Partially receive supply items' })
  @ApiParam({ name: 'id', description: 'Supply ID' })
  @ApiCookieAuth()
  async partialReceive(
    @Param('id') id: string,
    @Body() dto: PartialSupplyReceiveDto,
  ) {
    return this.scmSuppliesService.partialReceive(id, dto);
  }

  @Post(':supplyId/items')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add an item to supply (Admin only)',
  })
  @ApiParam({ name: 'supplyId', description: 'Supply ID' })
  @ApiResponse({
    status: 201,
    description: 'The item has been successfully added.',
  })
  @ApiResponse({
    status: 404,
    description: 'Supply or supplier item not found',
  })
  @ApiCookieAuth()
  async createItem(
    @Param('supplyId') supplyId: string,
    @Body() createDto: CreateScmSupplyItemDto,
  ) {
    return this.scmSuppliesService.createItem(supplyId, createDto);
  }

  @Patch(':supplyId/items/:itemId')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({
    summary: 'Update supply item (Admin only)',
  })
  @ApiParam({ name: 'supplyId', description: 'Supply ID' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  @ApiResponse({
    status: 200,
    description: 'The item has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Supply or item not found' })
  @ApiCookieAuth()
  async updateItem(
    @Param('supplyId') supplyId: string,
    @Param('itemId') itemId: string,
    @Body() updateDto: UpdateScmSupplyItemDto,
  ) {
    return this.scmSuppliesService.updateItem(supplyId, itemId, updateDto);
  }

  @Delete(':supplyId/items/:itemId')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete supply item (Admin only)',
  })
  @ApiParam({ name: 'supplyId', description: 'Supply ID' })
  @ApiParam({ name: 'itemId', description: 'Item ID' })
  @ApiResponse({
    status: 200,
    description: 'The item has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Supply or item not found' })
  @ApiCookieAuth()
  async deleteItem(
    @Param('supplyId') supplyId: string,
    @Param('itemId') itemId: string,
  ) {
    await this.scmSuppliesService.deleteItem(supplyId, itemId);
    return { success: true };
  }

  @Post(':id/receive')
  @Idempotency({ required: true })
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm receive of supply items (Admin only)',
    description:
      'Records received quantities, updates inventory balances, and updates supply status',
  })
  @ApiParam({ name: 'id', description: 'Supply ID' })
  @ApiResponse({
    status: 200,
    description: 'The supply has been successfully received.',
  })
  @ApiResponse({ status: 404, description: 'Supply not found' })
  @ApiResponse({ status: 400, description: 'Invalid receive data' })
  @ApiCookieAuth()
  async confirmReceive(
    @Param('id') supplyId: string,
    @Body() dto: ConfirmSupplyReceiveDto,
  ) {
    return this.scmSuppliesService.confirmReceive(supplyId, dto);
  }
}
