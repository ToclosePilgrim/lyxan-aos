import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateScmProductDto } from './dto/create-scm-product.dto';
import { UpdateScmProductDto } from './dto/update-scm-product.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ScmProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: {
    brandId?: string;
    search?: string;
  }) {
    const where: Prisma.ScmProductWhereInput = {};

    if (filters?.brandId) {
      where.brandId = filters.brandId;
    }

    if (filters?.search) {
      where.OR = [
        {
          internalName: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          sku: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const products = await this.prisma.scmProduct.findMany({
      where,
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            products: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return products.map((product) => ({
      id: product.id,
      internalName: product.internalName,
      sku: product.sku,
      type: product.type,
      brand: product.brand,
      baseDescription: product.baseDescription,
      composition: product.composition,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      listingsCount: product._count.products,
    }));
  }

  async findOne(id: string) {
    const product = await this.prisma.scmProduct.findUnique({
      where: { id },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        products: {
          select: {
            id: true,
            name: true,
            marketplace: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        suppliers: {
          include: {
            supplier: {
              include: {
                country: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`SCM product with ID ${id} not found`);
    }

    return {
      id: product.id,
      internalName: product.internalName,
      sku: product.sku,
      type: product.type,
      brand: product.brand,
      baseDescription: product.baseDescription,
      composition: product.composition,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      listings: product.products,
      suppliers: product.suppliers.map((link) => ({
        id: link.id,
        role: link.role,
        isPrimary: link.isPrimary,
        leadTimeDays: link.leadTimeDays,
        minOrderQty: link.minOrderQty,
        purchaseCurrency: link.purchaseCurrency,
        purchasePrice: link.purchasePrice ? link.purchasePrice.toNumber() : null,
        notes: link.notes,
        supplier: {
          id: link.supplier.id,
          name: link.supplier.name,
          code: link.supplier.code,
          types: link.supplier.types ?? [],
          primaryType: (link.supplier.types && link.supplier.types[0]) ?? null,
          country: link.supplier.country
            ? {
                id: link.supplier.country.id,
                code: link.supplier.country.code,
                name: link.supplier.country.name,
              }
            : null,
        },
      })),
    };
  }

  async create(dto: CreateScmProductDto) {
    // Validate brand if provided
    if (dto.brandId) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: dto.brandId },
      });

      if (!brand) {
        throw new NotFoundException(`Brand with ID ${dto.brandId} not found`);
      }
    }

    return this.prisma.scmProduct.create({
      data: {
        internalName: dto.internalName,
        sku: dto.sku,
        brandId: dto.brandId,
        type: dto.type || 'PURCHASED',
        baseDescription: dto.baseDescription,
        composition: dto.composition,
        netWeightGrams: dto.netWeightGrams,
        grossWeightGrams: dto.grossWeightGrams,
        lengthMm: dto.lengthMm,
        widthMm: dto.widthMm,
        heightMm: dto.heightMm,
        barcode: dto.barcode,
        countryOfOriginCode: dto.countryOfOriginCode,
        technicalAttributes: dto.technicalAttributes ? (dto.technicalAttributes as any) : undefined,
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async update(id: string, dto: UpdateScmProductDto) {
    const product = await this.prisma.scmProduct.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`SCM product with ID ${id} not found`);
    }

    // Validate brand if provided
    if (dto.brandId) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: dto.brandId },
      });

      if (!brand) {
        throw new NotFoundException(`Brand with ID ${dto.brandId} not found`);
      }
    }

    const updateData: Prisma.ScmProductUpdateInput = {};

    if (dto.internalName !== undefined) {
      updateData.internalName = dto.internalName;
    }

    if (dto.sku !== undefined) {
      updateData.sku = dto.sku;
    }

    if (dto.brandId !== undefined) {
      if (dto.brandId === null) {
        updateData.brand = { disconnect: true };
      } else {
        updateData.brand = { connect: { id: dto.brandId } };
      }
    }

    if (dto.type !== undefined) {
      updateData.type = dto.type;
    }

    if (dto.baseDescription !== undefined) {
      updateData.baseDescription = dto.baseDescription;
    }

    if (dto.composition !== undefined) {
      updateData.composition = dto.composition;
    }

    return this.prisma.scmProduct.update({
      where: { id },
      data: updateData,
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    const product = await this.prisma.scmProduct.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`SCM product with ID ${id} not found`);
    }

    if (product._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete SCM product: it has ${product._count.products} associated listing(s)`,
      );
    }

    return this.prisma.scmProduct.delete({
      where: { id },
    });
  }
}

