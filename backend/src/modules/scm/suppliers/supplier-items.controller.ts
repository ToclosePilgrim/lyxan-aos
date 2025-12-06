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
import { SupplierItemsService } from './supplier-items.service';
import { CreateSupplierItemDto } from './dto/create-supplier-item.dto';
import { UpdateSupplierItemDto } from './dto/update-supplier-item.dto';
import { FilterSupplierItemsDto } from './dto/filter-supplier-items.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('scm/suppliers')
@Controller('scm/suppliers')
@UseGuards(JwtAuthGuard)
export class SupplierItemsController {
  constructor(private readonly supplierItemsService: SupplierItemsService) {}

  @Get(':supplierId/items')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get list of supplier items' })
  @ApiParam({ name: 'supplierId', description: 'Supplier ID' })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by item type (MATERIAL or SERVICE)',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Filter by active status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of supplier items',
  })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiCookieAuth()
  async findAll(
    @Param('supplierId') supplierId: string,
    @Query() filters?: FilterSupplierItemsDto,
  ) {
    return this.supplierItemsService.findAllForSupplier(supplierId, filters);
  }

  @Get(':supplierId/items/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get supplier item by ID' })
  @ApiParam({ name: 'supplierId', description: 'Supplier ID' })
  @ApiParam({ name: 'id', description: 'Item ID' })
  @ApiResponse({
    status: 200,
    description: 'Supplier item details',
  })
  @ApiResponse({ status: 404, description: 'Supplier or item not found' })
  @ApiCookieAuth()
  async findOne(
    @Param('supplierId') supplierId: string,
    @Param('id') id: string,
  ) {
    return this.supplierItemsService.findOne(supplierId, id);
  }

  @Post(':supplierId/items')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new supplier item (Admin only)' })
  @ApiParam({ name: 'supplierId', description: 'Supplier ID' })
  @ApiResponse({
    status: 201,
    description: 'The supplier item has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiResponse({
    status: 409,
    description: 'Supplier item code already exists for this supplier',
  })
  @ApiCookieAuth()
  async create(
    @Param('supplierId') supplierId: string,
    @Body() createDto: CreateSupplierItemDto,
  ) {
    return this.supplierItemsService.create(supplierId, createDto);
  }

  @Patch(':supplierId/items/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update an existing supplier item (Admin only)' })
  @ApiParam({ name: 'supplierId', description: 'Supplier ID' })
  @ApiParam({ name: 'id', description: 'Item ID' })
  @ApiResponse({
    status: 200,
    description: 'The supplier item has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Supplier or item not found' })
  @ApiResponse({
    status: 409,
    description: 'Supplier item code already exists for this supplier',
  })
  @ApiCookieAuth()
  async update(
    @Param('supplierId') supplierId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateSupplierItemDto,
  ) {
    return this.supplierItemsService.update(supplierId, id, updateDto);
  }

  @Delete(':supplierId/items/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete a supplier item (set isActive=false) (Admin only)',
  })
  @ApiParam({ name: 'supplierId', description: 'Supplier ID' })
  @ApiParam({ name: 'id', description: 'Item ID' })
  @ApiResponse({
    status: 200,
    description: 'The supplier item has been successfully deactivated.',
  })
  @ApiResponse({ status: 404, description: 'Supplier or item not found' })
  @ApiCookieAuth()
  async remove(
    @Param('supplierId') supplierId: string,
    @Param('id') id: string,
  ) {
    return this.supplierItemsService.softDelete(supplierId, id);
  }
}




