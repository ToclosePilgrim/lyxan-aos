import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ScmService } from './scm.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyStatusDto } from './dto/update-supply-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('scm')
@Controller('scm')
@UseGuards(JwtAuthGuard)
export class ScmController {
  constructor(private readonly scmService: ScmService) {}

  // ============ Products ============

  @Get('products')
  @ApiOperation({ summary: 'Get list of products' })
  @ApiQuery({ name: 'name', required: false, description: 'Filter by product name' })
  @ApiQuery({ name: 'skuCode', required: false, description: 'Filter by SKU code' })
  @ApiQuery({ name: 'brandId', required: false, description: 'Filter by brand ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: Number })
  @ApiResponse({ status: 200, description: 'List of products' })
  @ApiCookieAuth()
  getProducts(
    @Query('name') name?: string,
    @Query('skuCode') skuCode?: string,
    @Query('brandId') brandId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: any = {};
    if (name) filters.name = name;
    if (skuCode) filters.skuCode = skuCode;
    if (brandId) filters.brandId = brandId;
    if (page) filters.page = parseInt(page, 10);
    if (limit) filters.limit = parseInt(limit, 10);

    return this.scmService.getProducts(filters);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product details' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiCookieAuth()
  getProductById(@Param('id') id: string) {
    return this.scmService.getProductById(id);
  }

  // POST /api/scm/products moved to BCM controller (POST /api/bcm/products)
  // This endpoint is now handled by ScmProductsController for SCM products
  // and BcmController for BCM listings

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiCookieAuth()
  updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.scmService.updateProduct(id, updateProductDto);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Delete product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiCookieAuth()
  deleteProduct(@Param('id') id: string) {
    return this.scmService.deleteProduct(id);
  }

  // ============ Stocks ============

  @Get('stocks')
  @ApiOperation({ summary: 'Get list of stocks' })
  @ApiQuery({ name: 'skuId', required: false, description: 'Filter by SKU ID' })
  @ApiQuery({ name: 'productId', required: false, description: 'Filter by product ID' })
  @ApiResponse({ status: 200, description: 'List of stocks' })
  @ApiCookieAuth()
  getStocks(
    @Query('skuId') skuId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.scmService.getStocks({ skuId, productId });
  }

  @Patch('stocks/:skuId')
  @ApiOperation({ summary: 'Update stock quantity' })
  @ApiParam({ name: 'skuId', description: 'SKU ID' })
  @ApiResponse({ status: 200, description: 'Stock updated successfully' })
  @ApiResponse({ status: 404, description: 'SKU not found' })
  @ApiResponse({ status: 400, description: 'Invalid quantity' })
  @ApiCookieAuth()
  updateStock(
    @Param('skuId') skuId: string,
    @Body() body: { quantity: number },
  ) {
    return this.scmService.updateStock(skuId, body.quantity);
  }

  // ============ Supplies ============

  @Get('supplies')
  @ApiOperation({ summary: 'Get list of supplies' })
  @ApiResponse({ status: 200, description: 'List of supplies' })
  @ApiCookieAuth()
  getSupplies() {
    return this.scmService.getSupplies();
  }

  @Get('supplies/:id')
  @ApiOperation({ summary: 'Get supply by ID' })
  @ApiParam({ name: 'id', description: 'Supply ID' })
  @ApiResponse({ status: 200, description: 'Supply details' })
  @ApiResponse({ status: 404, description: 'Supply not found' })
  @ApiCookieAuth()
  getSupplyById(@Param('id') id: string) {
    return this.scmService.getSupplyById(id);
  }

  @Post('supplies')
  @ApiOperation({ summary: 'Create a new supply' })
  @ApiResponse({ status: 201, description: 'Supply created successfully' })
  @ApiResponse({ status: 404, description: 'SKUs not found' })
  @ApiCookieAuth()
  createSupply(@Body() createSupplyDto: CreateSupplyDto) {
    return this.scmService.createSupply(createSupplyDto);
  }

  @Patch('supplies/:id/status')
  @ApiOperation({ summary: 'Update supply status' })
  @ApiParam({ name: 'id', description: 'Supply ID' })
  @ApiResponse({ status: 200, description: 'Supply status updated successfully' })
  @ApiResponse({ status: 404, description: 'Supply not found' })
  @ApiCookieAuth()
  updateSupplyStatus(
    @Param('id') id: string,
    @Body() updateSupplyStatusDto: UpdateSupplyStatusDto,
  ) {
    return this.scmService.updateSupplyStatus(id, updateSupplyStatusDto);
  }
}
