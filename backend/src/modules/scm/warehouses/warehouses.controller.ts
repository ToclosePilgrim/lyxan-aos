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
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseFiltersDto } from './dto/warehouse-filters.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('scm/warehouses')
@Controller('scm/warehouses')
@UseGuards(JwtAuthGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get list of warehouses with filters and pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of warehouses with total count',
  })
  @ApiCookieAuth()
  async findAll(@Query() filters: WarehouseFiltersDto) {
    return this.warehousesService.findAll(filters);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get warehouse details' })
  @ApiParam({ name: 'id', description: 'Warehouse ID' })
  @ApiResponse({
    status: 200,
    description: 'Warehouse details',
  })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  @ApiCookieAuth()
  async findOne(@Param('id') id: string) {
    return this.warehousesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new warehouse (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'The warehouse has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiCookieAuth()
  async create(@Body() createDto: CreateWarehouseDto) {
    return this.warehousesService.create(createDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update warehouse (Admin only)' })
  @ApiParam({ name: 'id', description: 'Warehouse ID' })
  @ApiResponse({
    status: 200,
    description: 'The warehouse has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  @ApiCookieAuth()
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateWarehouseDto,
  ) {
    return this.warehousesService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete warehouse (Admin only)' })
  @ApiParam({ name: 'id', description: 'Warehouse ID' })
  @ApiResponse({
    status: 200,
    description: 'The warehouse has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Warehouse not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete warehouse with dependencies' })
  @ApiCookieAuth()
  async remove(@Param('id') id: string) {
    return this.warehousesService.remove(id);
  }
}

