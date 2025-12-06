import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyStatusDto } from './dto/update-supply-status.dto';
import { AiUpdateProductContentDto } from './dto/ai-update-product-content.dto';
import { ListingVersionsService } from '../bcm/listing-versions/listing-versions.service';
import { ListingVersionSource } from '@prisma/client';
import { ProductContentVersionsService } from '../bcm/product-content-versions/product-content-versions.service';

@Injectable()
export class ScmService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ListingVersionsService))
    private listingVersionsService: ListingVersionsService,
    private readonly productContentVersionsService: ProductContentVersionsService,
  ) {}

  // ============ Products ============

  async getProducts(filters?: {
    name?: string;
    skuCode?: string;
    brandId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const take = Math.min(Number(filters?.limit) || 50, 100);
    const skip = (page - 1) * take;

    const where: any = {};

    if (filters?.name) {
      where.name = { contains: filters.name, mode: 'insensitive' };
    }

    if (filters?.brandId) {
      where.brandId = filters.brandId;
    }

    if (filters?.skuCode) {
      where.skus = {
        some: {
          code: { contains: filters.skuCode, mode: 'insensitive' },
        },
      };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          marketplace: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          skus: {
            include: {
              stocks: true,
            },
            take: 1,
            orderBy: { createdAt: 'asc' },
          },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Calculate total stock quantity for each product
    const productsWithStock = products.map((product) => {
      const totalStock = product.skus.reduce((sum, sku) => {
        return sum + (sku.stocks[0]?.quantity || 0);
      }, 0);

      const mainSku = product.skus[0];

      return {
        ...product,
        totalStock,
        mainSku: mainSku
          ? {
              code: mainSku.code,
              price: mainSku.price,
              cost: mainSku.cost,
            }
          : null,
        skusCount: product.skus.length,
      };
    });

    return {
      data: productsWithStock,
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  async getProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        marketplace: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        skus: {
          include: {
            stocks: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Add stock quantity to each SKU
    const skusWithStock = product.skus.map((sku) => ({
      ...sku,
      stockQuantity: sku.stocks[0]?.quantity || 0,
    }));

    return {
      ...product,
      skus: skusWithStock,
    };
  }

  async createProduct(dto: CreateProductDto) {
    // Check if brand exists
    const brand = await this.prisma.brand.findUnique({
      where: { id: dto.brandId },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${dto.brandId} not found`);
    }

    // Check if SCM product exists (if provided)
    if (dto.scmProductId) {
      const scmProduct = await this.prisma.scmProduct.findUnique({
        where: { id: dto.scmProductId },
      });

      if (!scmProduct) {
        // Don't throw 404, just set scmProductId to null
        // The prefill endpoint will handle validation
        dto.scmProductId = undefined;
      }
    }

    // Check if marketplace exists (if provided)
    if (dto.marketplaceId) {
      const marketplace = await this.prisma.marketplace.findUnique({
        where: { id: dto.marketplaceId },
      });

      if (!marketplace) {
        throw new NotFoundException(
          `Marketplace with ID ${dto.marketplaceId} not found`,
        );
      }
    }

    // Check if SKU code already exists
    const existingSku = await this.prisma.sku.findUnique({
      where: { code: dto.skuCode },
    });

    if (existingSku) {
      throw new ConflictException(`SKU with code ${dto.skuCode} already exists`);
    }

    // Create product with SKU and stock in transaction
    const product = await this.prisma.$transaction(async (tx) => {
      return await tx.product.create({
        data: {
          name: dto.name,
          brandId: dto.brandId,
          scmProductId: dto.scmProductId ?? null,
          marketplaceId: dto.marketplaceId,
          category: dto.category,
          title: dto.title ?? null,
          subtitle: dto.subtitle ?? null,
          shortDescription: dto.shortDescription ?? null,
          fullDescription: dto.fullDescription ?? null,
          keywords: dto.keywords ?? null,
          mpTitle: dto.mpTitle ?? null,
          mpSubtitle: dto.mpSubtitle ?? null,
          mpShortDescription: dto.mpShortDescription ?? null,
          mpDescription: dto.mpDescription ?? null,
          contentAttributes: dto.contentAttributes ? (dto.contentAttributes as any) : undefined,
          aiContentEnabled: dto.aiContentEnabled ?? true,
          skus: {
            create: {
              code: dto.skuCode,
              name: dto.skuName,
              price: dto.price,
              cost: dto.cost,
              stocks: {
                create: {
                  quantity: 0,
                },
              },
            },
          },
        },
        include: {
          brand: true,
          marketplace: true,
          scmProduct: {
            select: {
              id: true,
              internalName: true,
              sku: true,
            },
          },
          skus: {
            include: {
              stocks: true,
            },
          },
        },
      });
    });

    // Create initial SYSTEM version for product content AFTER transaction commits
    try {
      await this.productContentVersionsService.createVersion({
        productId: product.id,
        source: 'SYSTEM',
        userId: null,
        comment: 'Initial version',
      });
    } catch (error) {
      // Log error but don't fail the creation
      console.error('Failed to create initial content version:', error);
    }

    return product;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const current = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!current) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Check if brand exists (if being updated)
    if (dto.brandId && dto.brandId !== current.brandId) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: dto.brandId },
      });

      if (!brand) {
        throw new NotFoundException(`Brand with ID ${dto.brandId} not found`);
      }
    }

    // Check if SCM product exists (if being updated)
    if (dto.scmProductId && dto.scmProductId !== current.scmProductId) {
      const scmProduct = await this.prisma.scmProduct.findUnique({
        where: { id: dto.scmProductId },
      });

      if (!scmProduct) {
        throw new NotFoundException(`SCM product with ID ${dto.scmProductId} not found`);
      }
    }

    // Check if marketplace exists (if being updated)
    if (dto.marketplaceId !== undefined) {
      if (dto.marketplaceId && dto.marketplaceId !== current.marketplaceId) {
        const marketplace = await this.prisma.marketplace.findUnique({
          where: { id: dto.marketplaceId },
        });

        if (!marketplace) {
          throw new NotFoundException(
            `Marketplace with ID ${dto.marketplaceId} not found`,
          );
        }
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.brandId !== undefined) updateData.brandId = dto.brandId;
    if (dto.scmProductId !== undefined) updateData.scmProductId = dto.scmProductId;
    if (dto.marketplaceId !== undefined) updateData.marketplaceId = dto.marketplaceId;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.title !== undefined) updateData.title = dto.title ?? null;
    if (dto.subtitle !== undefined) updateData.subtitle = dto.subtitle ?? null;
    if (dto.shortDescription !== undefined) updateData.shortDescription = dto.shortDescription ?? null;
    if (dto.fullDescription !== undefined) updateData.fullDescription = dto.fullDescription ?? null;
    if (dto.keywords !== undefined) updateData.keywords = dto.keywords ?? null;
    if (dto.mpTitle !== undefined) updateData.mpTitle = dto.mpTitle ?? null;
    if (dto.mpSubtitle !== undefined) updateData.mpSubtitle = dto.mpSubtitle ?? null;
    if (dto.mpShortDescription !== undefined) updateData.mpShortDescription = dto.mpShortDescription ?? null;
    if (dto.mpDescription !== undefined) updateData.mpDescription = dto.mpDescription ?? null;
    if (dto.contentAttributes !== undefined) updateData.contentAttributes = dto.contentAttributes as any;
    if (dto.aiContentEnabled !== undefined) updateData.aiContentEnabled = dto.aiContentEnabled;

    // If updateData is empty and no saveVersion, just return current product
    if (Object.keys(updateData).length === 0 && !dto.saveVersion) {
      return this.prisma.product.findUnique({
        where: { id },
        include: {
          brand: true,
          marketplace: true,
          skus: {
            include: {
              stocks: true,
            },
          },
        },
      });
    }

    // If updateData is empty but saveVersion is set, fetch current product without update
    let updated;
    if (Object.keys(updateData).length === 0 && dto.saveVersion) {
      updated = await this.prisma.product.findUnique({
        where: { id },
        include: {
          brand: true,
          marketplace: true,
          skus: {
            include: {
              stocks: true,
            },
          },
        },
      });
    } else {
      updated = await this.prisma.product.update({
        where: { id },
        data: updateData,
        include: {
          brand: true,
          marketplace: true,
          skus: {
            include: {
              stocks: true,
            },
          },
        },
      });
    }

    // Check if content fields changed or saveVersion flag is set
    const contentFieldsChanged =
      (dto.title !== undefined && dto.title !== (current.title ?? null)) ||
      (dto.subtitle !== undefined && dto.subtitle !== (current.subtitle ?? null)) ||
      (dto.shortDescription !== undefined &&
        dto.shortDescription !== (current.shortDescription ?? null)) ||
      (dto.fullDescription !== undefined &&
        dto.fullDescription !== (current.fullDescription ?? null)) ||
      (dto.keywords !== undefined && dto.keywords !== (current.keywords ?? null));

    // Check if marketplace content fields changed
    const marketplaceContentFieldsChanged =
      (dto.mpTitle !== undefined && dto.mpTitle !== (current.mpTitle ?? null)) ||
      (dto.mpSubtitle !== undefined && dto.mpSubtitle !== (current.mpSubtitle ?? null)) ||
      (dto.mpShortDescription !== undefined &&
        dto.mpShortDescription !== (current.mpShortDescription ?? null)) ||
      (dto.mpDescription !== undefined &&
        dto.mpDescription !== (current.mpDescription ?? null)) ||
      (dto.keywords !== undefined && dto.keywords !== (current.keywords ?? null));

    // Create listing version if legacy content fields changed
    if (dto.saveVersion || contentFieldsChanged) {
      try {
        await this.listingVersionsService.createVersionForListing(id, {
          source: ListingVersionSource.MANUAL,
          reason: dto.saveVersion ? 'Manual content update' : undefined,
          createdByUserId: null,
        });
      } catch (error) {
        console.error('Failed to create listing content version:', error);
      }
    }

    // Create product content version if marketplace content fields changed
    if (dto.saveVersion || marketplaceContentFieldsChanged) {
      try {
        await this.productContentVersionsService.createVersion({
          productId: id,
          source: 'MANUAL',
          userId: null,
          comment: 'Manual update via UI',
        });
      } catch (error) {
        console.error('Failed to create product content version:', error);
      }
    }

    return updated;
  }

  async updateContentByAi(id: string, dto: AiUpdateProductContentDto) {
    // Check if product exists
    const existingProduct = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Update only content fields
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        mpTitle: dto.mpTitle ?? undefined,
        mpShortDescription: dto.mpShortDescription ?? undefined,
        mpDescription: dto.mpDescription ?? undefined,
        keywords: dto.keywords ?? undefined,
        contentAttributes: dto.contentAttributes ? (dto.contentAttributes as any) : undefined,
      },
      include: {
        brand: true,
        marketplace: true,
        skus: {
          include: {
            stocks: true,
          },
        },
      },
    });

    // Create version for AI update
    try {
      await this.productContentVersionsService.createVersion({
        productId: product.id,
        source: 'AI',
        userId: null, // TODO: get from user context
        agentLabel: 'ozon-content-agent-v1', // TODO: make this configurable
        comment: 'AI content update',
      });
    } catch (error) {
      // Log error but don't fail the update
      console.error('Failed to create AI content version:', error);
    }

    // Return 200 status (not 201) as expected by tests
    return product;
  }

  async prefillTechnicalFromScm(productId: string, user?: any) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { scmProduct: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.scmProductId) {
      throw new BadRequestException('SCM product is not linked');
    }

    if (!product.scmProduct) {
      throw new BadRequestException('SCM product not found');
    }

    const scm = product.scmProduct;

    // Готовим update-данные: заполняем только если в Listing пусто
    const updateData: any = {};

    const copyIfEmpty = (
      field: string,
      currentValue: unknown,
      scmValue: any,
    ) => {
      if ((currentValue === null || currentValue === undefined) && scmValue !== undefined && scmValue !== null) {
        updateData[field] = scmValue;
      }
    };

    copyIfEmpty('netWeightGrams', product.netWeightGrams, scm.netWeightGrams);
    copyIfEmpty('grossWeightGrams', product.grossWeightGrams, scm.grossWeightGrams);
    copyIfEmpty('lengthMm', product.lengthMm, scm.lengthMm);
    copyIfEmpty('widthMm', product.widthMm, scm.widthMm);
    copyIfEmpty('heightMm', product.heightMm, scm.heightMm);
    copyIfEmpty('barcode', product.barcode, scm.barcode);
    copyIfEmpty('countryOfOriginCode', product.countryOfOriginCode, scm.countryOfOriginCode);

    // Слияние technicalAttributes как default-значений
    if (product.technicalAttributes == null && scm.technicalAttributes != null) {
      updateData.technicalAttributes = scm.technicalAttributes;
    }

    let updated: any;

    if (Object.keys(updateData).length > 0) {
      // Обновляем только если есть изменения
      updated = await this.prisma.product.update({
        where: { id: productId },
        data: updateData,
        include: {
          brand: true,
          marketplace: true,
          scmProduct: {
            select: {
              id: true,
              internalName: true,
              sku: true,
            },
          },
          skus: {
            include: {
              stocks: true,
            },
          },
        },
      });
    } else {
      // Если данных для обновления нет, загружаем product с includes
      const loaded = await this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          brand: true,
          marketplace: true,
          scmProduct: {
            select: {
              id: true,
              internalName: true,
              sku: true,
            },
          },
          skus: {
            include: {
              stocks: true,
            },
          },
        },
      });
      if (!loaded) {
        throw new NotFoundException('Product not found');
      }
      updated = loaded;
    }

    // Создаем версию всегда после успешного prefill
    try {
      await this.productContentVersionsService.createVersion({
        productId: updated.id,
        source: 'SYSTEM',
        userId: user?.id ?? null,
        comment: 'Technical data prefilled from SCM product',
      });
    } catch (error) {
      // Log error but don't fail the update
      console.error('Failed to create content version:', error);
    }

    return updated;
  }

  async deleteProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Hard delete (CASCADE will handle related records)
    await this.prisma.product.delete({
      where: { id },
    });

    return {
      message: `Product with ID ${id} has been deleted`,
    };
  }

  // ============ Stocks ============

  async getStocks(filters?: { skuId?: string; productId?: string }) {
    const where: any = {};

    if (filters?.skuId) {
      where.skuId = filters.skuId;
    }

    if (filters?.productId) {
      where.sku = {
        productId: filters.productId,
      };
    }

    const stocks = await this.prisma.stock.findMany({
      where,
      include: {
        sku: {
          include: {
            product: {
              include: {
                brand: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return stocks.map((stock) => ({
      id: stock.id,
      skuId: stock.skuId,
      skuCode: stock.sku.code,
      skuName: stock.sku.name,
      productName: stock.sku.product.name,
      productBrand: stock.sku.product.brand.name,
      quantity: stock.quantity,
      updatedAt: stock.updatedAt,
    }));
  }

  async updateStock(skuId: string, quantity: number) {
    // Check if SKU exists
    const sku = await this.prisma.sku.findUnique({
      where: { id: skuId },
    });

    if (!sku) {
      throw new NotFoundException(`SKU with ID ${skuId} not found`);
    }

    if (quantity < 0) {
      throw new BadRequestException('Stock quantity cannot be negative');
    }

    // Upsert stock (create if doesn't exist, update if exists)
    return this.prisma.stock.upsert({
      where: { skuId },
      update: { quantity },
      create: {
        skuId,
        quantity,
      },
      include: {
        sku: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  // ============ Supplies ============

  async getSupplies() {
    const supplies = await this.prisma.supply.findMany({
      include: {
        items: {
          include: {
            sku: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return supplies.map((supply) => ({
      ...supply,
      itemsCount: supply.items.length,
      totalQuantity: supply.items.reduce((sum, item) => sum + item.quantity, 0),
    }));
  }

  async getSupplyById(id: string) {
    const supply = await this.prisma.supply.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            sku: {
              include: {
                product: {
                  include: {
                    brand: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!supply) {
      throw new NotFoundException(`Supply with ID ${id} not found`);
    }

    return {
      ...supply,
      itemsCount: supply.items.length,
      totalQuantity: supply.items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  async createSupply(dto: CreateSupplyDto) {
    // Validate all SKUs exist
    const skuIds = dto.items.map((item) => item.skuId);
    const existingSkus = await this.prisma.sku.findMany({
      where: {
        id: { in: skuIds },
      },
    });

    if (existingSkus.length !== skuIds.length) {
      const existingIds = existingSkus.map((s) => s.id);
      const missingIds = skuIds.filter((id) => !existingIds.includes(id));
      throw new NotFoundException(
        `SKUs not found: ${missingIds.join(', ')}`,
      );
    }

    // Create supply with items in transaction
    return this.prisma.$transaction(async (tx) => {
      const supply = await tx.supply.create({
        data: {
          status: 'PENDING',
          items: {
            create: dto.items.map((item) => ({
              skuId: item.skuId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: {
            include: {
              sku: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });

      return supply;
    });
  }

  async updateSupplyStatus(id: string, dto: UpdateSupplyStatusDto) {
    const supply = await this.prisma.supply.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!supply) {
      throw new NotFoundException(`Supply with ID ${id} not found`);
    }

    // If status is RECEIVED, update stock quantities
    if (dto.status === 'RECEIVED' && supply.status !== 'RECEIVED') {
      await this.prisma.$transaction(async (tx) => {
        // Update each item's stock
        for (const item of supply.items) {
          await tx.stock.upsert({
            where: { skuId: item.skuId },
            update: {
              quantity: {
                increment: item.quantity,
              },
            },
            create: {
              skuId: item.skuId,
              quantity: item.quantity,
            },
          });
        }
      });
    }

    return this.prisma.supply.update({
      where: { id },
      data: {
        status: dto.status,
      },
      include: {
        items: {
          include: {
            sku: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });
  }
}
