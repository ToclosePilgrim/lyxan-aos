import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ContentChangeSource } from '@prisma/client';

export interface CreateProductContentVersionParams {
  productId: string;
  source: 'MANUAL' | 'AI' | 'SYSTEM';
  userId?: string | null;
  agentLabel?: string | null;
  comment?: string | null;
}

@Injectable()
export class ProductContentVersionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createVersion(params: CreateProductContentVersionParams) {
    const product = await this.prisma.product.findUnique({
      where: { id: params.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Get marketplace code from product if available
    let marketplaceCode: string | null = null;
    if (product.marketplaceId) {
      const marketplace = await this.prisma.marketplace.findUnique({
        where: { id: product.marketplaceId },
        select: { code: true },
      });
      marketplaceCode = marketplace?.code ?? null;
    }

    // Auto-increment versionNumber per product
    const lastVersion = await this.prisma.productContentVersion.findFirst({
      where: { productId: params.productId },
      orderBy: { versionNumber: 'desc' },
    });

    const versionNumber = lastVersion?.versionNumber ? lastVersion.versionNumber + 1 : 1;

    return this.prisma.productContentVersion.create({
      data: {
        productId: product.id,
        marketplaceCode,
        versionNumber,

        mpTitle: product.mpTitle ?? null,
        mpSubtitle: product.mpSubtitle ?? null,
        mpShortDescription: product.mpShortDescription ?? null,
        mpDescription: product.mpDescription ?? null,
        keywords: product.keywords ?? null,
        contentAttributes: product.contentAttributes as any,

        source: params.source as ContentChangeSource,
        userId: params.userId ?? null,
        agentLabel: params.agentLabel ?? null,
        comment: params.comment ?? null,
      },
    });
  }

  async findAllForProduct(productId: string) {
    return this.prisma.productContentVersion.findMany({
      where: { productId },
      orderBy: { versionNumber: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const version = await this.prisma.productContentVersion.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!version) {
      throw new NotFoundException('Content version not found');
    }

    return version;
  }
}


