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
import { SupplierServicesService } from './supplier-services.service';
import { CreateSupplierServiceDto } from './dto/create-supplier-service.dto';
import { UpdateSupplierServiceDto } from './dto/update-supplier-service.dto';
import { FilterSupplierServicesDto } from './dto/filter-supplier-services.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('scm/suppliers')
@Controller('scm/suppliers')
@UseGuards(JwtAuthGuard)
export class SupplierServicesController {
  constructor(
    private readonly supplierServicesService: SupplierServicesService,
  ) {}

  @Get(':supplierId/services')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get list of supplier services' })
  @ApiParam({ name: 'supplierId', description: 'Supplier ID' })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Filter by active status',
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'List of supplier services',
  })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiCookieAuth()
  async findAll(
    @Param('supplierId') supplierId: string,
    @Query() filters?: FilterSupplierServicesDto,
  ) {
    return this.supplierServicesService.findAllForSupplier(
      supplierId,
      filters?.isActive,
    );
  }

  @Get(':supplierId/services/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get supplier service by ID' })
  @ApiParam({ name: 'supplierId', description: 'Supplier ID' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiResponse({
    status: 200,
    description: 'Supplier service details',
  })
  @ApiResponse({ status: 404, description: 'Supplier or service not found' })
  @ApiCookieAuth()
  async findOne(
    @Param('supplierId') supplierId: string,
    @Param('id') id: string,
  ) {
    return this.supplierServicesService.findOne(supplierId, id);
  }

  @Post(':supplierId/services')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new supplier service (Admin only)' })
  @ApiParam({ name: 'supplierId', description: 'Supplier ID' })
  @ApiResponse({
    status: 201,
    description: 'The supplier service has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiResponse({
    status: 409,
    description: 'Supplier service code already exists for this supplier',
  })
  @ApiCookieAuth()
  async create(
    @Param('supplierId') supplierId: string,
    @Body() createDto: CreateSupplierServiceDto,
  ) {
    return this.supplierServicesService.create(supplierId, createDto);
  }

  @Patch(':supplierId/services/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update an existing supplier service (Admin only)' })
  @ApiParam({ name: 'supplierId', description: 'Supplier ID' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiResponse({
    status: 200,
    description: 'The supplier service has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Supplier or service not found' })
  @ApiResponse({
    status: 409,
    description: 'Supplier service code already exists for this supplier',
  })
  @ApiCookieAuth()
  async update(
    @Param('supplierId') supplierId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateSupplierServiceDto,
  ) {
    return this.supplierServicesService.update(supplierId, id, updateDto);
  }

  @Delete(':supplierId/services/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete a supplier service (set isActive=false) (Admin only)',
  })
  @ApiParam({ name: 'supplierId', description: 'Supplier ID' })
  @ApiParam({ name: 'id', description: 'Service ID' })
  @ApiResponse({
    status: 200,
    description: 'The supplier service has been successfully deactivated.',
  })
  @ApiResponse({ status: 404, description: 'Supplier or service not found' })
  @ApiCookieAuth()
  async remove(
    @Param('supplierId') supplierId: string,
    @Param('id') id: string,
  ) {
    return this.supplierServicesService.softDelete(supplierId, id);
  }
}

