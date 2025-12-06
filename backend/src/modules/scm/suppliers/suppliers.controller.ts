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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { FilterSuppliersDto } from './dto/filter-suppliers.dto';
import { LinkScmProductDto } from './dto/link-scm-product.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('scm/suppliers')
@Controller('scm/suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get list of suppliers' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name, code, or tags',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by supplier type (single value)',
  })
  @ApiQuery({
    name: 'types',
    required: false,
    description: 'Filter by supplier types (comma-separated, e.g., "MANUFACTURER,COMPONENT_SUPPLIER")',
  })
  @ApiQuery({
    name: 'countryId',
    required: false,
    description: 'Filter by country ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by supplier status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of suppliers',
  })
  @ApiCookieAuth()
  async findAll(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('types') types?: string,
    @Query('countryId') countryId?: string,
    @Query('status') status?: string,
  ) {
    const filters: FilterSuppliersDto = {
      search,
      type: type as any,
      types: types ? types.split(',').map(t => t.trim()) as any : undefined,
      countryId,
      status: status as any,
    };
    return this.suppliersService.findAll(filters);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get detailed information for a supplier' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiResponse({
    status: 200,
    description: 'Detailed supplier information',
  })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiCookieAuth()
  async findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new supplier (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'The supplier has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  @ApiResponse({ status: 409, description: 'Supplier code already exists' })
  @ApiCookieAuth()
  async create(@Body() createDto: CreateSupplierDto) {
    return this.suppliersService.create(createDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update an existing supplier (Admin only)' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiResponse({
    status: 200,
    description: 'The supplier has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiResponse({ status: 409, description: 'Supplier code already exists' })
  @ApiCookieAuth()
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a supplier (Admin only)' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiResponse({
    status: 204,
    description: 'The supplier has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiCookieAuth()
  async remove(@Param('id') id: string) {
    await this.suppliersService.remove(id);
  }

  @Post(':id/link-product')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Link a SCM product to a supplier (Admin only)' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiResponse({
    status: 201,
    description: 'The product has been successfully linked to the supplier.',
  })
  @ApiResponse({ status: 404, description: 'Supplier or SCM product not found' })
  @ApiResponse({
    status: 409,
    description: 'Link between supplier and product already exists',
  })
  @ApiCookieAuth()
  async linkScmProduct(
    @Param('id') id: string,
    @Body() linkDto: LinkScmProductDto,
  ) {
    return this.suppliersService.linkScmProduct(id, linkDto);
  }

  @Delete(':id/link-product/:scmProductId')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Unlink a SCM product from a supplier (Admin only)',
  })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiParam({ name: 'scmProductId', description: 'SCM Product ID' })
  @ApiResponse({
    status: 204,
    description: 'The product has been successfully unlinked from the supplier.',
  })
  @ApiResponse({ status: 404, description: 'Link not found' })
  @ApiCookieAuth()
  async unlinkScmProduct(
    @Param('id') id: string,
    @Param('scmProductId') scmProductId: string,
  ) {
    await this.suppliersService.unlinkScmProduct(id, scmProductId);
  }
}


