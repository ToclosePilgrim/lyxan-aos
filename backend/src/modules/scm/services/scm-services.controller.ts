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
import { ScmServicesService } from './scm-services.service';
import { CreateScmServiceDto } from './dto/create-scm-service.dto';
import { UpdateScmServiceDto } from './dto/update-scm-service.dto';
import { FilterScmServicesDto } from './dto/filter-scm-services.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@ApiTags('scm/services')
@Controller('scm/services')
@UseGuards(JwtAuthGuard)
export class ScmServicesController {
  constructor(private readonly scmServicesService: ScmServicesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get list of service operations' })
  @ApiQuery({ name: 'productionOrderId', required: false })
  @ApiQuery({ name: 'supplyId', required: false })
  @ApiQuery({ name: 'supplierId', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'financialDocumentId', required: false })
  @ApiResponse({ status: 200, description: 'List of service operations' })
  @ApiCookieAuth()
  async findAll(@Query() filters?: FilterScmServicesDto) {
    return this.scmServicesService.findAll(filters);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get service operation details' })
  @ApiParam({ name: 'id', description: 'Service Operation ID' })
  @ApiResponse({ status: 200, description: 'Service operation details' })
  @ApiResponse({ status: 404, description: 'Service operation not found' })
  @ApiCookieAuth()
  async findOne(@Param('id') id: string) {
    return this.scmServicesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new service operation (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'The service operation has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Related entity not found' })
  @ApiCookieAuth()
  async create(@Body() createDto: CreateScmServiceDto) {
    return this.scmServicesService.create(createDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update service operation (Admin only)' })
  @ApiParam({ name: 'id', description: 'Service Operation ID' })
  @ApiResponse({
    status: 200,
    description: 'The service operation has been successfully updated.',
  })
  @ApiResponse({ status: 404, description: 'Service operation not found' })
  @ApiCookieAuth()
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateScmServiceDto,
  ) {
    return this.scmServicesService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete service operation (Admin only)' })
  @ApiParam({ name: 'id', description: 'Service Operation ID' })
  @ApiResponse({
    status: 200,
    description: 'The service operation has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Service operation not found' })
  @ApiCookieAuth()
  async remove(@Param('id') id: string) {
    return this.scmServicesService.remove(id);
  }
}




