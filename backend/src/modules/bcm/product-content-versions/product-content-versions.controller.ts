import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ProductContentVersionsService } from './product-content-versions.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('bcm')
@Controller('bcm/products/:productId/content-versions')
@UseGuards(JwtAuthGuard)
export class ProductContentVersionsController {
  constructor(
    private readonly versionsService: ProductContentVersionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get content version history for a product' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'List of content versions' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiCookieAuth()
  async getVersions(@Param('productId') productId: string) {
    const versions = await this.versionsService.findAllForProduct(productId);
    return versions.map((v) => {
      const ver: any = v;
      return {
        id: v.id,
        productId: v.productId,
        marketplaceCode: v.marketplaceCode,
        mpTitle: v.mpTitle,
        mpSubtitle: v.mpSubtitle,
        mpShortDescription: v.mpShortDescription,
        mpDescription: v.mpDescription,
        keywords: v.keywords,
        contentAttributes: v.contentAttributes,
        source: v.source,
        userId: v.userId,
        user: v.user,
        agentLabel: v.agentLabel,
        comment: v.comment,
        createdAt: v.createdAt,
        versionNumber: ver.versionNumber ?? null,
      };
    });
  }

  @Get(':versionId')
  @ApiOperation({ summary: 'Get a specific content version' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiParam({ name: 'versionId', description: 'Version ID' })
  @ApiResponse({ status: 200, description: 'Content version details' })
  @ApiResponse({ status: 404, description: 'Version not found' })
  @ApiCookieAuth()
  async getVersion(
    @Param('productId') productId: string,
    @Param('versionId') versionId: string,
  ) {
    const v = await this.versionsService.findOne(versionId);

    if (v.productId !== productId) {
      throw new NotFoundException('Version does not belong to this product');
    }

    const ver: any = v;
    return {
      id: v.id,
      productId: v.productId,
      versionNumber: ver.versionNumber ?? null,
      marketplaceCode: v.marketplaceCode,
      mpTitle: v.mpTitle,
      mpSubtitle: v.mpSubtitle,
      mpShortDescription: v.mpShortDescription,
      mpDescription: v.mpDescription,
      keywords: v.keywords,
      contentAttributes: v.contentAttributes,
      source: v.source,
      userId: v.userId,
      user: v.user,
      agentLabel: v.agentLabel,
      comment: v.comment,
      createdAt: v.createdAt,
    };
  }
}

