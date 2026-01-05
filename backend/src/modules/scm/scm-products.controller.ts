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
import { ScmProductsService } from './scm-products.service';
import { CreateScmProductDto } from './dto/create-scm-product.dto';
import { UpdateScmProductDto } from './dto/update-scm-product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('scm/products')
@Controller('scm/products')
@UseGuards(JwtAuthGuard)
export class ScmProductsController {
  constructor(private readonly scmProductsService: ScmProductsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get list of SCM products' })
  @ApiQuery({
    name: 'brandId',
    required: false,
    description: 'Filter by Brand ID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by internal name or SKU',
  })
  @ApiResponse({
    status: 200,
    description: 'List of SCM products',
  })
  @ApiCookieAuth()
  async findAll(
    @Query('brandId') brandId?: string,
    @Query('search') search?: string,
  ) {
    return this.scmProductsService.findAll({ brandId, search });
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get detailed information for a SCM product' })
  @ApiParam({ name: 'id', description: 'SCM Product ID' })
  @ApiResponse({
    status: 200,
    description: 'Detailed SCM product information',
  })
  @ApiResponse({ status: 404, description: 'SCM product not found' })
  @ApiCookieAuth()
  async findOne(@Param('id') id: string) {
    return this.scmProductsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new SCM product (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'The SCM product has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  @ApiCookieAuth()
  async create(@Body() createDto: CreateScmProductDto) {
    return this.scmProductsService.create(createDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update an existing SCM product (Admin only)' })
  @ApiParam({ name: 'id', description: 'SCM Product ID' })
  @ApiResponse({
    status: 200,
    description: 'The SCM product has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'SCM product not found' })
  @ApiCookieAuth()
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateScmProductDto,
  ) {
    return this.scmProductsService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a SCM product (Admin only)' })
  @ApiParam({ name: 'id', description: 'SCM Product ID' })
  @ApiResponse({
    status: 204,
    description: 'The SCM product has been successfully deleted.',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete: has associated listings',
  })
  @ApiResponse({ status: 404, description: 'SCM product not found' })
  @ApiCookieAuth()
  async remove(@Param('id') id: string) {
    await this.scmProductsService.remove(id);
  }
}

