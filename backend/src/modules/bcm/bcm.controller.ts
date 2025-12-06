import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
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
import { BcmService } from './bcm.service';
import { ScmService } from '../scm/scm.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { UpdateProductCardDto } from './dto/update-product-card.dto';
import { CreateProductDto } from '../scm/dto/create-product.dto';
import { AiUpdateProductContentDto } from '../scm/dto/ai-update-product-content.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('bcm')
@Controller('bcm')
@UseGuards(JwtAuthGuard)
export class BcmController {
  constructor(
    private readonly bcmService: BcmService,
    private readonly scmService: ScmService,
  ) {}

  // ============ Brand ============

  @Get('brands')
  @ApiOperation({ summary: 'Get list of all brands' })
  @ApiResponse({ status: 200, description: 'List of brands' })
  @ApiCookieAuth()
  getBrands() {
    return this.bcmService.getBrands();
  }

  @Get('brands/:id')
  @ApiOperation({ summary: 'Get brand by ID' })
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiResponse({ status: 200, description: 'Brand information' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  @ApiCookieAuth()
  getBrandById(@Param('id') id: string) {
    return this.bcmService.getBrandById(id);
  }

  @Post('brands')
  @ApiOperation({ summary: 'Create a new brand' })
  @ApiResponse({ status: 201, description: 'Brand created successfully' })
  @ApiResponse({ status: 409, description: 'Brand code already exists' })
  @ApiResponse({ status: 404, description: 'One or more countries not found' })
  @ApiCookieAuth()
  createBrand(@Body() createBrandDto: CreateBrandDto) {
    return this.bcmService.createBrand(createBrandDto);
  }

  @Patch('brands/:id')
  @ApiOperation({ summary: 'Update brand by ID' })
  @ApiParam({ name: 'id', description: 'Brand ID' })
  @ApiResponse({ status: 200, description: 'Brand updated successfully' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  @ApiResponse({ status: 409, description: 'Brand code already exists' })
  @ApiCookieAuth()
  updateBrandById(
    @Param('id') id: string,
    @Body() updateBrandDto: UpdateBrandDto,
  ) {
    return this.bcmService.updateBrandById(id, updateBrandDto);
  }

  // Legacy endpoints for backward compatibility
  @Get('brand')
  @ApiOperation({ summary: 'Get first brand (legacy)' })
  @ApiResponse({ status: 200, description: 'Brand information' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  @ApiCookieAuth()
  getBrand() {
    return this.bcmService.getBrand();
  }

  @Patch('brand')
  @ApiOperation({ summary: 'Update first brand (legacy)' })
  @ApiResponse({ status: 200, description: 'Brand updated successfully' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  @ApiResponse({ status: 409, description: 'Brand code already exists' })
  @ApiCookieAuth()
  updateBrand(@Body() updateBrandDto: UpdateBrandDto) {
    return this.bcmService.updateBrand(updateBrandDto);
  }

  // ============ ProductCard / Listings ============

  @Post('products')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new marketplace listing (Admin only)' })
  @ApiResponse({ status: 201, description: 'Listing created successfully' })
  @ApiResponse({ status: 404, description: 'Brand, SCM Product or Marketplace not found' })
  @ApiResponse({ status: 409, description: 'SKU code already exists' })
  @ApiCookieAuth()
  createListing(@Body() createProductDto: CreateProductDto) {
    return this.scmService.createProduct(createProductDto);
  }

  @Get('products')
  @ApiOperation({ summary: 'Get list of products with cards' })
  @ApiResponse({ status: 200, description: 'List of products with card status' })
  @ApiCookieAuth()
  getProductsWithCards() {
    return this.bcmService.getProductsWithCards();
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get product card by product ID' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product card details' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiCookieAuth()
  getProductCard(@Param('id') id: string) {
    return this.bcmService.getProductCard(id);
  }

  @Patch('products/:id/card')
  @ApiOperation({ summary: 'Create or update product card' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product card updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiCookieAuth()
  upsertProductCard(
    @Param('id') id: string,
    @Body() updateProductCardDto: UpdateProductCardDto,
  ) {
    return this.bcmService.upsertProductCard(id, updateProductCardDto);
  }

  @Post('products/:id/ai-content')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update product content by AI agent (n8n)' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product content updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiCookieAuth()
  updateContentByAi(
    @Param('id') id: string,
    @Body() dto: AiUpdateProductContentDto,
  ) {
    return this.scmService.updateContentByAi(id, dto);
  }

  @Post('products/:productId/prefill-technical-from-scm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Prefill technical data from linked SCM product' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Technical data prefilled successfully' })
  @ApiResponse({ status: 400, description: 'SCM product is not linked' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiCookieAuth()
  prefillTechnicalFromScm(@Param('productId') productId: string) {
    return this.scmService.prefillTechnicalFromScm(productId);
  }
}
