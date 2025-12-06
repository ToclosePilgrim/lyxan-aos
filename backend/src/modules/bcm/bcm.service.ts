import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { UpdateProductCardDto } from './dto/update-product-card.dto';

@Injectable()
export class BcmService {
  constructor(private prisma: PrismaService) {}

  // ============ Brand ============

  async getBrands() {
    const brands = await this.prisma.brand.findMany({
      include: {
        countries: {
          include: {
            country: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            legalEntity: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      code: brand.code,
      description: brand.description,
      toneOfVoice: brand.toneOfVoice,
      countries: brand.countries.map((bc) => ({
        country: bc.country,
        legalEntity: bc.legalEntity,
      })),
      products_count: brand._count.products,
      created_at: brand.createdAt,
    }));
  }

  async getBrandById(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        countries: {
          include: {
            country: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            legalEntity: true,
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    return {
      ...brand,
      countries: brand.countries.map((bc) => ({
        country: bc.country,
        legalEntity: bc.legalEntity,
      })),
    };
  }

  async createBrand(dto: CreateBrandDto) {
    // Check if code already exists
    const codeExists = await this.prisma.brand.findUnique({
      where: { code: dto.code },
    });

    if (codeExists) {
      throw new ConflictException(`Brand with code ${dto.code} already exists`);
    }

    // Validate all countries exist
    const countries = await this.prisma.country.findMany({
      where: {
        id: {
          in: dto.countryIds,
        },
      },
    });

    if (countries.length !== dto.countryIds.length) {
      const foundIds = countries.map((c) => c.id);
      const missingIds = dto.countryIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Countries with IDs ${missingIds.join(', ')} not found`,
      );
    }

    // Create brand with countries
    return this.prisma.brand.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description ?? null,
        toneOfVoice: dto.toneOfVoice ?? null,
        countries: {
          create: dto.countryIds.map((countryId) => ({
            countryId,
          })),
        },
      },
      include: {
        countries: {
          include: {
            country: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            legalEntity: true,
          },
        },
      },
    });
  }

  async updateBrandById(id: string, dto: UpdateBrandDto) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    // Check if code is being updated and if it's already taken
    if (dto.code && dto.code !== brand.code) {
      const codeExists = await this.prisma.brand.findUnique({
        where: { code: dto.code },
      });

      if (codeExists) {
        throw new ConflictException(`Brand with code ${dto.code} already exists`);
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    if (dto.code !== undefined) {
      updateData.code = dto.code;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description ?? null;
    }

    if (dto.toneOfVoice !== undefined) {
      updateData.toneOfVoice = dto.toneOfVoice ?? null;
    }

    // Handle countries update
    if (dto.countryIds !== undefined) {
      // Validate all countries exist
      const countries = await this.prisma.country.findMany({
        where: {
          id: {
            in: dto.countryIds,
          },
        },
      });

      if (countries.length !== dto.countryIds.length) {
        const foundIds = countries.map((c) => c.id);
        const missingIds = dto.countryIds.filter((id) => !foundIds.includes(id));
        throw new NotFoundException(
          `Countries with IDs ${missingIds.join(', ')} not found`,
        );
      }

      // Delete existing relations and create new ones
      await this.prisma.brandCountry.deleteMany({
        where: { brandId: id },
      });

      updateData.countries = {
        create: dto.countryIds.map((countryId) => ({
          countryId,
        })),
      };
    }

    return this.prisma.brand.update({
      where: { id },
      data: updateData,
      include: {
        countries: {
          include: {
            country: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            legalEntity: true,
          },
        },
      },
    });
  }

  // Legacy method for backward compatibility
  async getBrand() {
    const brand = await this.prisma.brand.findFirst({
      include: {
        countries: {
          include: {
            country: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            legalEntity: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found. Please create a brand first.');
    }

    return {
      ...brand,
      countries: brand.countries.map((bc) => ({
        country: bc.country,
        legalEntity: bc.legalEntity,
      })),
    };
  }

  async updateBrand(dto: UpdateBrandDto) {
    const brand = await this.prisma.brand.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found. Please create a brand first.');
    }

    return this.updateBrandById(brand.id, dto);
  }

  // ============ ProductCard ============

  async getProductsWithCards() {
    const products = await this.prisma.product.findMany({
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
        scmProduct: {
          select: {
            id: true,
            internalName: true,
            sku: true,
          },
        },
        productCard: true,
        skus: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return products.map((product) => {
      const card = product.productCard;
      const isCardComplete =
        card && card.title && card.description && card.title.trim() !== '' && card.description.trim() !== '';

      return {
        ...product,
        skusCount: product.skus.length,
        cardStatus: card ? (isCardComplete ? 'Complete' : 'Needs work') : 'No card',
        hasCard: !!card,
      };
    });
  }

  async getProductCard(productId: string) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
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
        scmProduct: {
          select: {
            id: true,
            internalName: true,
            sku: true,
            brand: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        skus: {
          select: {
            id: true,
            code: true,
            name: true,
            price: true,
            cost: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    // Get or create product card
    let productCard = await this.prisma.productCard.findUnique({
      where: { productId },
    });

    if (!productCard) {
      // Create empty card if doesn't exist
      productCard = await this.prisma.productCard.create({
        data: {
          productId,
          title: null,
          description: null,
        },
      });
    }

    return {
      product,
      card: productCard,
    };
  }

  async upsertProductCard(productId: string, dto: UpdateProductCardDto) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    // Prepare update data
    const updateData: any = {};

    if (dto.title !== undefined) {
      updateData.title = dto.title || null;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description || null;
    }

    if (dto.attributes !== undefined) {
      updateData.attributes = dto.attributes;
    }

    if (dto.images !== undefined) {
      updateData.images = dto.images;
    }

    // Prepare create data
    const createData: any = {
      productId,
      title: dto.title || null,
      description: dto.description || null,
    };

    if (dto.attributes !== undefined) {
      createData.attributes = dto.attributes;
    }

    if (dto.images !== undefined) {
      createData.images = dto.images;
    }

    // Upsert product card
    return this.prisma.productCard.upsert({
      where: { productId },
      update: updateData,
      create: createData,
      include: {
        product: {
          include: {
            brand: true,
            marketplace: true,
          },
        },
      },
    });
  }
}
