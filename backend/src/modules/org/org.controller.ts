import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import { OrgService } from './org.service';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { CreateMarketplaceDto } from './dto/create-marketplace.dto';
import { UpdateMarketplaceDto } from './dto/update-marketplace.dto';
import { AddCountryToBrandDto } from './dto/add-country-to-brand.dto';
import { UpdateLegalEntityDto } from './dto/update-legal-entity.dto';
import { UpdateMarketplaceCountriesDto } from './dto/update-marketplace-countries.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('org')
@Controller('org')
@UseGuards(JwtAuthGuard)
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  // ============ Countries ============

  @Get('countries')
  @ApiOperation({ summary: 'Get all countries' })
  @ApiResponse({ status: 200, description: 'List of countries' })
  @ApiCookieAuth()
  getCountries() {
    return this.orgService.getCountries();
  }

  @Get('countries/:id')
  @ApiOperation({ summary: 'Get country by ID' })
  @ApiResponse({ status: 200, description: 'Country details' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  @ApiCookieAuth()
  getCountryById(@Param('id') id: string) {
    return this.orgService.getCountryById(id);
  }

  @Post('countries')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Create a new country (Admin only)' })
  @ApiResponse({ status: 201, description: 'Country created successfully' })
  @ApiResponse({ status: 409, description: 'Country code already exists' })
  @ApiCookieAuth()
  createCountry(@Body() createCountryDto: CreateCountryDto) {
    return this.orgService.createCountry(createCountryDto);
  }

  @Patch('countries/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update country (Admin only)' })
  @ApiResponse({ status: 200, description: 'Country updated successfully' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  @ApiCookieAuth()
  updateCountry(
    @Param('id') id: string,
    @Body() updateCountryDto: UpdateCountryDto,
  ) {
    return this.orgService.updateCountry(id, updateCountryDto);
  }

  @Delete('countries/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Delete country (Admin only)' })
  @ApiResponse({ status: 200, description: 'Country deleted successfully' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete country with associated brands',
  })
  @ApiCookieAuth()
  deleteCountry(@Param('id') id: string) {
    return this.orgService.deleteCountry(id);
  }

  // ============ Brands ============

  @Get('brands')
  @ApiOperation({ summary: 'Get all brands' })
  @ApiResponse({ status: 200, description: 'List of brands' })
  @ApiCookieAuth()
  getBrands() {
    return this.orgService.getBrands();
  }

  @Get('brands/:id')
  @ApiOperation({ summary: 'Get brand by ID' })
  @ApiResponse({ status: 200, description: 'Brand details' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  @ApiCookieAuth()
  getBrandById(@Param('id') id: string) {
    return this.orgService.getBrandById(id);
  }

  @Post('brands')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Create a new brand (Admin only)' })
  @ApiResponse({ status: 201, description: 'Brand created successfully' })
  @ApiResponse({ status: 409, description: 'Brand code already exists' })
  @ApiResponse({ status: 404, description: 'Country not found' })
  @ApiCookieAuth()
  createBrand(@Body() createBrandDto: CreateBrandDto) {
    return this.orgService.createBrand(createBrandDto);
  }

  @Patch('brands/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update brand (Admin only)' })
  @ApiResponse({ status: 200, description: 'Brand updated successfully' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  @ApiCookieAuth()
  updateBrand(
    @Param('id') id: string,
    @Body() updateBrandDto: UpdateBrandDto,
  ) {
    return this.orgService.updateBrand(id, updateBrandDto);
  }

  @Delete('brands/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Delete brand (Admin only)' })
  @ApiResponse({ status: 200, description: 'Brand deleted successfully' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete brand with associated marketplaces',
  })
  @ApiCookieAuth()
  deleteBrand(@Param('id') id: string) {
    return this.orgService.deleteBrand(id);
  }

  // ============ Marketplaces ============

  @Get('marketplaces')
  @ApiOperation({ summary: 'Get all marketplaces' })
  @ApiResponse({ status: 200, description: 'List of marketplaces' })
  @ApiCookieAuth()
  getMarketplaces() {
    return this.orgService.getMarketplaces();
  }

  @Get('marketplaces/:id')
  @ApiOperation({ summary: 'Get marketplace by ID' })
  @ApiResponse({ status: 200, description: 'Marketplace details' })
  @ApiResponse({ status: 404, description: 'Marketplace not found' })
  @ApiCookieAuth()
  getMarketplaceById(@Param('id') id: string) {
    return this.orgService.getMarketplaceById(id);
  }

  @Post('marketplaces')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Create a new marketplace (Admin only)' })
  @ApiResponse({ status: 201, description: 'Marketplace created successfully' })
  @ApiResponse({ status: 409, description: 'Marketplace code already exists' })
  @ApiCookieAuth()
  createMarketplace(@Body() createMarketplaceDto: CreateMarketplaceDto) {
    return this.orgService.createMarketplace(createMarketplaceDto);
  }

  @Patch('marketplaces/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update marketplace (Admin only)' })
  @ApiResponse({ status: 200, description: 'Marketplace updated successfully' })
  @ApiResponse({ status: 404, description: 'Marketplace not found' })
  @ApiCookieAuth()
  updateMarketplace(
    @Param('id') id: string,
    @Body() updateMarketplaceDto: UpdateMarketplaceDto,
  ) {
    return this.orgService.updateMarketplace(id, updateMarketplaceDto);
  }

  @Delete('marketplaces/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Delete marketplace (Admin only)' })
  @ApiResponse({ status: 200, description: 'Marketplace deleted successfully' })
  @ApiResponse({ status: 404, description: 'Marketplace not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete marketplace with associated products',
  })
  @ApiCookieAuth()
  deleteMarketplace(@Param('id') id: string) {
    return this.orgService.deleteMarketplace(id);
  }

  @Put('marketplaces/:id/countries')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update marketplace countries (Admin only)' })
  @ApiParam({ name: 'id', description: 'Marketplace ID' })
  @ApiResponse({ status: 200, description: 'Marketplace countries updated successfully' })
  @ApiResponse({ status: 404, description: 'Marketplace or country not found' })
  @ApiCookieAuth()
  updateMarketplaceCountries(
    @Param('id') id: string,
    @Body() updateDto: UpdateMarketplaceCountriesDto,
  ) {
    return this.orgService.updateMarketplaceCountries(id, updateDto.countryIds);
  }

  // ============ Brand Countries & Legal Entities ============

  @Post('brands/:brandId/countries')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Add country to brand (Admin only)' })
  @ApiParam({ name: 'brandId', description: 'Brand ID' })
  @ApiResponse({ status: 201, description: 'Country added to brand successfully' })
  @ApiResponse({ status: 404, description: 'Brand or country not found' })
  @ApiResponse({ status: 409, description: 'Country already associated with brand' })
  @ApiCookieAuth()
  addCountryToBrand(
    @Param('brandId') brandId: string,
    @Body() addCountryDto: AddCountryToBrandDto,
  ) {
    return this.orgService.addCountryToBrand(brandId, addCountryDto);
  }

  @Delete('brands/:brandId/countries/:countryId')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Remove country from brand (Admin only)' })
  @ApiParam({ name: 'brandId', description: 'Brand ID' })
  @ApiParam({ name: 'countryId', description: 'Country ID' })
  @ApiResponse({ status: 200, description: 'Country removed from brand successfully' })
  @ApiResponse({ status: 404, description: 'Brand-country relation not found' })
  @ApiCookieAuth()
  removeCountryFromBrand(
    @Param('brandId') brandId: string,
    @Param('countryId') countryId: string,
  ) {
    return this.orgService.removeCountryFromBrand(brandId, countryId);
  }

  @Put('brands/:brandId/countries/:countryId/legal-entity')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Create or update legal entity for brand-country (Admin only)' })
  @ApiParam({ name: 'brandId', description: 'Brand ID' })
  @ApiParam({ name: 'countryId', description: 'Country ID' })
  @ApiResponse({ status: 200, description: 'Legal entity created/updated successfully' })
  @ApiResponse({ status: 404, description: 'Brand-country relation not found' })
  @ApiCookieAuth()
  upsertLegalEntityForBrandCountry(
    @Param('brandId') brandId: string,
    @Param('countryId') countryId: string,
    @Body() updateLegalEntityDto: UpdateLegalEntityDto,
  ) {
    return this.orgService.upsertLegalEntityForBrandCountry(
      brandId,
      countryId,
      updateLegalEntityDto,
    );
  }
}
