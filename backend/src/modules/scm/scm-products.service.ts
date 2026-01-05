import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateScmProductDto } from './dto/create-scm-product.dto';
import { UpdateScmProductDto } from './dto/update-scm-product.dto';
import { Prisma, ScmProductType } from '@prisma/client';

@Injectable()
export class ScmProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { brandId?: string; search?: string }) {
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
        Brand: {
          select: {
            id: true,
            name: true,
            code: true,
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
      brand: product.Brand,
      baseDescription: product.baseDescription,
      composition: product.composition,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      listingsCount: 0,
    }));
  }

  async findOne(id: string) {
    const product = await this.prisma.scmProduct.findUnique({
      where: { id },
      include: {
        Brand: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        ScmProductSupplier: {
          include: {
            supplierCounterparty: {
              include: {
                Country: {
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
      brand: product.Brand,
      baseDescription: product.baseDescription,
      composition: product.composition,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      listings: [],
      suppliers: product.ScmProductSupplier.map((link) => ({
        id: link.id,
        role: link.role,
        isPrimary: link.isPrimary,
        leadTimeDays: link.leadTimeDays,
        minOrderQty: link.minOrderQty,
        purchaseCurrency: link.purchaseCurrency,
        purchasePrice: link.purchasePrice
          ? link.purchasePrice.toNumber()
          : null,
        notes: link.notes,
        supplier: {
          id: link.supplierCounterparty.id,
          name: link.supplierCounterparty.name,
          code: link.supplierCounterparty.code,
          roles: link.supplierCounterparty.roles ?? [],
          primaryType:
            (link.supplierCounterparty.roles &&
              link.supplierCounterparty.roles[0]) ??
            null,
          country: link.supplierCounterparty.Country
            ? {
                id: link.supplierCounterparty.Country.id,
                code: link.supplierCounterparty.Country.code,
                name: link.supplierCounterparty.Country.name,
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
        itemId: dto.itemId,
        type: dto.type ?? ScmProductType.PURCHASED,
        baseDescription: dto.baseDescription,
        composition: dto.composition,
      },
      include: {
        Brand: {
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
        updateData.Brand = { disconnect: true };
      } else {
        updateData.Brand = { connect: { id: dto.brandId } };
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

    if (dto.itemId !== undefined) {
      if (dto.itemId === null) {
        updateData.MdmItem = { disconnect: true };
      } else {
        updateData.MdmItem = { connect: { id: dto.itemId } };
      }
    }

    return this.prisma.scmProduct.update({
      where: { id },
      data: updateData,
      include: {
        Brand: {
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
    });

    if (!product) {
      throw new NotFoundException(`SCM product with ID ${id} not found`);
    }

    if (product.itemId) {
      const listingsCount = await this.prisma.bcmListingProfile.count({
        where: { itemId: product.itemId },
      });
      if (listingsCount > 0) {
        throw new BadRequestException(
          `Cannot delete SCM product: its MDM item has ${listingsCount} associated listing(s)`,
        );
      }
    }

    return this.prisma.scmProduct.delete({
      where: { id },
    });
  }
}
