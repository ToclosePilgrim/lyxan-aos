import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
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
import { ScmBomService } from './scm-bom.service';
import { CreateBomItemDto } from './dto/create-bom-item.dto';
import { UpdateBomItemDto } from './dto/update-bom-item.dto';
import { UpsertBomDto } from './dto/upsert-bom.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('scm/products')
@Controller('scm/products')
@UseGuards(JwtAuthGuard)
export class ScmBomController {
  constructor(private readonly scmBomService: ScmBomService) {}

  @Get(':productId/bom')
  @UseGuards(RolesGuard)
  @Roles('Admin', 'Manager')
  @ApiOperation({ summary: 'Get BOM (Bill of Materials) for a product' })
  @ApiParam({ name: 'productId', description: 'SCM Product ID' })
  @ApiResponse({
    status: 200,
    description: 'BOM with product info and items',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiCookieAuth()
  async getBom(@Param('productId') productId: string) {
    return this.scmBomService.getBom(productId);
  }

  @Post(':productId/bom/items')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new BOM item (Admin only)' })
  @ApiParam({ name: 'productId', description: 'SCM Product ID' })
  @ApiResponse({
    status: 201,
    description: 'The BOM item has been successfully created.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Product or supplier item not found' })
  @ApiCookieAuth()
  async createBomItem(
    @Param('productId') productId: string,
    @Body() createDto: CreateBomItemDto,
  ) {
    return this.scmBomService.createBomItem(productId, createDto);
  }

  @Patch(':productId/bom/items/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({ summary: 'Update an existing BOM item (Admin only)' })
  @ApiParam({ name: 'productId', description: 'SCM Product ID' })
  @ApiParam({ name: 'id', description: 'BOM Item ID' })
  @ApiResponse({
    status: 200,
    description: 'The BOM item has been successfully updated.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Product or BOM item not found' })
  @ApiCookieAuth()
  async updateBomItem(
    @Param('productId') productId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateBomItemDto,
  ) {
    return this.scmBomService.updateBomItem(productId, id, updateDto);
  }

  @Delete(':productId/bom/items/:id')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a BOM item (Admin only)' })
  @ApiParam({ name: 'productId', description: 'SCM Product ID' })
  @ApiParam({ name: 'id', description: 'BOM Item ID' })
  @ApiResponse({
    status: 200,
    description: 'The BOM item has been successfully deleted.',
  })
  @ApiResponse({ status: 404, description: 'Product or BOM item not found' })
  @ApiCookieAuth()
  async deleteBomItem(
    @Param('productId') productId: string,
    @Param('id') id: string,
  ) {
    return this.scmBomService.deleteBomItem(productId, id);
  }

  @Put(':productId/bom')
  @UseGuards(RolesGuard)
  @Roles('Admin')
  @ApiOperation({
    summary: 'Replace entire BOM (mass update) (Admin only)',
  })
  @ApiParam({ name: 'productId', description: 'SCM Product ID' })
  @ApiResponse({
    status: 200,
    description: 'The BOM has been successfully replaced.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Product or supplier item not found' })
  @ApiCookieAuth()
  async upsertBom(
    @Param('productId') productId: string,
    @Body() upsertDto: UpsertBomDto,
  ) {
    return this.scmBomService.upsertBom(productId, upsertDto);
  }
}




