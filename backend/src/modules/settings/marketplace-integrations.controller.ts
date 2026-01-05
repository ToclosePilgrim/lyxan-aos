import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
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
import { MarketplaceIntegrationsService } from './marketplace-integrations.service';
import { CreateMarketplaceIntegrationDto } from './dto/create-marketplace-integration.dto';
import { UpdateMarketplaceIntegrationDto } from './dto/update-marketplace-integration.dto';
import { TestConnectionDto } from './dto/test-connection.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('settings')
@Controller('settings/marketplace-integrations')
@UseGuards(JwtAuthGuard)
export class MarketplaceIntegrationsController {
  constructor(
    private readonly marketplaceIntegrationsService: MarketplaceIntegrationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get list of marketplace integrations' })
  @ApiQuery({
    name: 'brandId',
    required: false,
    description: 'Filter by brand ID',
  })
  @ApiQuery({
    name: 'countryId',
    required: false,
    description: 'Filter by country ID',
  })
  @ApiQuery({
    name: 'marketplaceCode',
    required: false,
    description: 'Filter by marketplace code',
  })
  @ApiResponse({
    status: 200,
    description: 'List of marketplace integrations',
  })
  @ApiCookieAuth()
  findAll(
    @Query('brandId') brandId?: string,
    @Query('countryId') countryId?: string,
    @Query('marketplaceCode') marketplaceCode?: string,
  ) {
    return this.marketplaceIntegrationsService.findAll({
      brandId,
      countryId,
      marketplaceCode,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get marketplace integration by ID' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({
    status: 200,
    description: 'Marketplace integration details',
  })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  @ApiCookieAuth()
  findOne(@Param('id') id: string) {
    return this.marketplaceIntegrationsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new marketplace integration' })
  @ApiResponse({
    status: 201,
    description: 'Marketplace integration created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({
    status: 404,
    description: 'Marketplace, Brand or Country not found',
  })
  @ApiResponse({ status: 409, description: 'Integration already exists' })
  @ApiCookieAuth()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateMarketplaceIntegrationDto) {
    return this.marketplaceIntegrationsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update marketplace integration' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({
    status: 200,
    description: 'Marketplace integration updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  @ApiCookieAuth()
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMarketplaceIntegrationDto,
  ) {
    return this.marketplaceIntegrationsService.update(id, dto);
  }

  @Post(':id/test-connection')
  @ApiOperation({ summary: 'Test marketplace integration connection' })
  @ApiParam({ name: 'id', description: 'Integration ID' })
  @ApiResponse({
    status: 200,
    description: 'Connection test result',
  })
  @ApiResponse({ status: 404, description: 'Integration not found' })
  @ApiCookieAuth()
  @HttpCode(HttpStatus.OK)
  testConnection(@Param('id') id: string, @Body() dto?: TestConnectionDto) {
    return this.marketplaceIntegrationsService.testConnection(id, dto);
  }
}
