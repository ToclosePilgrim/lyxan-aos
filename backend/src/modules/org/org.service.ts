import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { CreateMarketplaceDto } from './dto/create-marketplace.dto';
import { UpdateMarketplaceDto } from './dto/update-marketplace.dto';
import { AddCountryToBrandDto } from './dto/add-country-to-brand.dto';
import { UpdateLegalEntityDto } from './dto/update-legal-entity.dto';
import { UpdateMarketplaceCountriesDto } from './dto/update-marketplace-countries.dto';

@Injectable()
export class OrgService {
  constructor(private prisma: PrismaService) {}

  // ============ Countries ============

  async getCountries() {
    return this.prisma.country.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getCountryById(id: string) {
    const country = await this.prisma.country.findUnique({
      where: { id },
      include: {
        brands: {
          include: {
            brand: true,
          },
        },
      },
    });

    if (!country) {
      throw new NotFoundException(`Country with ID ${id} not found`);
    }

    return country;
  }

  async createCountry(dto: CreateCountryDto) {
    // Check if code already exists
    const existingCountry = await this.prisma.country.findUnique({
      where: { code: dto.code },
    });

    if (existingCountry) {
      throw new ConflictException(`Country with code ${dto.code} already exists`);
    }

    return this.prisma.country.create({
      data: dto,
    });
  }

  async updateCountry(id: string, dto: UpdateCountryDto) {
    const country = await this.prisma.country.findUnique({
      where: { id },
    });

    if (!country) {
      throw new NotFoundException(`Country with ID ${id} not found`);
    }

    // Check if code is being updated and if it's already taken
    if (dto.code && dto.code !== country.code) {
      const codeExists = await this.prisma.country.findUnique({
        where: { code: dto.code },
      });

      if (codeExists) {
        throw new ConflictException(`Country with code ${dto.code} already exists`);
      }
    }

    return this.prisma.country.update({
      where: { id },
      data: dto,
    });
  }

  async deleteCountry(id: string) {
    const country = await this.prisma.country.findUnique({
      where: { id },
      include: {
        brands: true,
      },
    });

    if (!country) {
      throw new NotFoundException(`Country with ID ${id} not found`);
    }

    if (country.brands.length > 0) {
      throw new BadRequestException(
        `Cannot delete country with ID ${id} because it has associated brands`,
      );
    }

    await this.prisma.country.delete({
      where: { id },
    });

    return {
      message: `Country with ID ${id} has been deleted`,
    };
  }

  // ============ Brands ============

  async getBrands() {
    return this.prisma.brand.findMany({
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
      orderBy: { name: 'asc' },
    });
  }

  async getBrandById(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        countries: {
          include: {
            country: true,
            legalEntity: true,
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    return brand;
  }

  async createBrand(dto: CreateBrandDto) {
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

    // Check if code already exists
    const existingBrand = await this.prisma.brand.findUnique({
      where: { code: dto.code },
    });

    if (existingBrand) {
      throw new ConflictException(`Brand with code ${dto.code} already exists`);
    }

    // Create brand with countries
    return this.prisma.brand.create({
      data: {
        name: dto.name,
        code: dto.code,
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

  async updateBrand(id: string, dto: UpdateBrandDto) {
    // Get current brand with countries
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        countries: true,
      },
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

      // Get current country IDs
      const currentCountryIds = brand.countries.map((bc) => bc.countryId);

      // Calculate what to remove and what to add
      const toRemove = currentCountryIds.filter(
        (id) => !dto.countryIds!.includes(id),
      );
      const toAdd = dto.countryIds!.filter(
        (id) => !currentCountryIds.includes(id),
      );

      // Delete removed relations
      if (toRemove.length > 0) {
        await this.prisma.brandCountry.deleteMany({
          where: {
            brandId: brand.id,
            countryId: { in: toRemove },
          },
        });
      }

      // Add new relations
      if (toAdd.length > 0) {
        await this.prisma.brandCountry.createMany({
          data: toAdd.map((countryId) => ({
            brandId: brand.id,
            countryId,
          })),
        });
      }
    }

    // Update brand fields
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

  async deleteBrand(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        products: true,
      },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    if (brand.products.length > 0) {
      throw new BadRequestException(
        `Cannot delete brand with ID ${id} because it has associated products`,
      );
    }

    await this.prisma.brand.delete({
      where: { id },
    });

    return {
      message: `Brand with ID ${id} has been deleted`,
    };
  }

  // ============ Marketplaces ============

  async getMarketplaces() {
    return this.prisma.marketplace.findMany({
      include: {
        markets: {
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
      orderBy: { name: 'asc' },
    });
  }

  async getMarketplaceById(id: string) {
    const marketplace = await this.prisma.marketplace.findUnique({
      where: { id },
      include: {
        markets: {
          include: {
            country: true,
          },
        },
      },
    });

    if (!marketplace) {
      throw new NotFoundException(`Marketplace with ID ${id} not found`);
    }

    return marketplace;
  }

  async createMarketplace(dto: CreateMarketplaceDto) {
    // Check if code already exists
    const existingMarketplace = await this.prisma.marketplace.findUnique({
      where: { code: dto.code },
    });

    if (existingMarketplace) {
      throw new ConflictException(
        `Marketplace with code ${dto.code} already exists`,
      );
    }

    const createData: any = {
      name: dto.name,
      code: dto.code,
    };
    if (dto.logoUrl !== undefined) {
      createData.logoUrl = dto.logoUrl;
    }

    return this.prisma.marketplace.create({
      data: createData,
      include: {
        markets: {
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
    });
  }

  async updateMarketplace(id: string, dto: UpdateMarketplaceDto) {
    const marketplace = await this.prisma.marketplace.findUnique({
      where: { id },
    });

    if (!marketplace) {
      throw new NotFoundException(`Marketplace with ID ${id} not found`);
    }

    // Check if code is being updated and if it's already taken
    if (dto.code && dto.code !== marketplace.code) {
      const codeExists = await this.prisma.marketplace.findUnique({
        where: { code: dto.code },
      });

      if (codeExists) {
        throw new ConflictException(
          `Marketplace with code ${dto.code} already exists`,
        );
      }
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.code !== undefined) updateData.code = dto.code;
    if (dto.logoUrl !== undefined) updateData.logoUrl = dto.logoUrl;

    return this.prisma.marketplace.update({
      where: { id },
      data: updateData,
      include: {
        markets: {
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
    });
  }

  async deleteMarketplace(id: string) {
    const marketplace = await this.prisma.marketplace.findUnique({
      where: { id },
      include: {
        products: true,
      },
    });

    if (!marketplace) {
      throw new NotFoundException(`Marketplace with ID ${id} not found`);
    }

    if (marketplace.products.length > 0) {
      throw new BadRequestException(
        `Cannot delete marketplace with ID ${id} because it has associated products`,
      );
    }

    await this.prisma.marketplace.delete({
      where: { id },
    });

    return {
      message: `Marketplace with ID ${id} has been deleted`,
    };
  }

  async updateMarketplaceCountries(
    marketplaceId: string,
    countryIds: string[],
  ) {
    // Check if marketplace exists
    const marketplace = await this.prisma.marketplace.findUnique({
      where: { id: marketplaceId },
    });

    if (!marketplace) {
      throw new NotFoundException(
        `Marketplace with ID ${marketplaceId} not found`,
      );
    }

    // Validate all countries exist
    const countries = await this.prisma.country.findMany({
      where: {
        id: {
          in: countryIds,
        },
      },
    });

    if (countries.length !== countryIds.length) {
      const foundIds = countries.map((c) => c.id);
      const missingIds = countryIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Countries with IDs ${missingIds.join(', ')} not found`,
      );
    }

    // Get current country IDs
    const currentRelations = await this.prisma.marketplaceCountry.findMany({
      where: { marketplaceId },
    });
    const currentCountryIds = currentRelations.map((r) => r.countryId);

    // Calculate what to remove and what to add
    const toRemove = currentCountryIds.filter(
      (id) => !countryIds.includes(id),
    );
    const toAdd = countryIds.filter((id) => !currentCountryIds.includes(id));

    // Delete removed relations
    if (toRemove.length > 0) {
      await this.prisma.marketplaceCountry.deleteMany({
        where: {
          marketplaceId,
          countryId: { in: toRemove },
        },
      });
    }

    // Add new relations
    if (toAdd.length > 0) {
      await this.prisma.marketplaceCountry.createMany({
        data: toAdd.map((countryId) => ({
          marketplaceId,
          countryId,
        })),
      });
    }

    // Return updated marketplace with countries
    return this.prisma.marketplace.findUnique({
      where: { id: marketplaceId },
      include: {
        markets: {
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
    });
  }

  // ============ Brand Countries & Legal Entities ============

  async addCountryToBrand(brandId: string, dto: AddCountryToBrandDto) {
    // Check if brand exists
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${brandId} not found`);
    }

    // Check if country exists
    const country = await this.prisma.country.findUnique({
      where: { id: dto.countryId },
    });

    if (!country) {
      throw new NotFoundException(`Country with ID ${dto.countryId} not found`);
    }

    // Check if relation already exists
    const existingRelation = await this.prisma.brandCountry.findUnique({
      where: {
        brandId_countryId: {
          brandId,
          countryId: dto.countryId,
        },
      },
    });

    if (existingRelation) {
      throw new ConflictException(
        `Brand ${brandId} is already associated with country ${dto.countryId}`,
      );
    }

    // Create BrandCountry relation
    return this.prisma.brandCountry.create({
      data: {
        brandId,
        countryId: dto.countryId,
      },
      include: {
        country: true,
        legalEntity: true,
      },
    });
  }

  async removeCountryFromBrand(brandId: string, countryId: string) {
    // Check if relation exists
    const relation = await this.prisma.brandCountry.findUnique({
      where: {
        brandId_countryId: {
          brandId,
          countryId,
        },
      },
    });

    if (!relation) {
      throw new NotFoundException(
        `Brand ${brandId} is not associated with country ${countryId}`,
      );
    }

    // Delete relation (legalEntity will be set to null if exists)
    await this.prisma.brandCountry.delete({
      where: {
        brandId_countryId: {
          brandId,
          countryId,
        },
      },
    });

    return {
      message: `Country ${countryId} removed from brand ${brandId}`,
    };
  }

  async upsertLegalEntityForBrandCountry(
    brandId: string,
    countryId: string,
    dto: UpdateLegalEntityDto,
  ) {
    // Check if BrandCountry relation exists
    const brandCountry = await this.prisma.brandCountry.findUnique({
      where: {
        brandId_countryId: {
          brandId,
          countryId,
        },
      },
      include: {
        legalEntity: true,
      },
    });

    if (!brandCountry) {
      throw new NotFoundException(
        `Brand ${brandId} is not associated with country ${countryId}`,
      );
    }

    // If legalEntity already exists, update it
    if (brandCountry.legalEntityId && brandCountry.legalEntity) {
      const updated = await this.prisma.legalEntity.update({
        where: { id: brandCountry.legalEntityId },
        data: dto,
      });

      return {
        brandCountry: {
          ...brandCountry,
          legalEntity: updated,
        },
      };
    }

    // Create new LegalEntity
    const legalEntity = await this.prisma.legalEntity.create({
      data: {
        name: dto.name || '',
        countryId,
        inn: dto.inn,
        kpp: dto.kpp,
        ogrn: dto.ogrn,
        legalAddr: dto.legalAddr,
        bankName: dto.bankName,
        bik: dto.bik,
        account: dto.account,
        corrAccount: dto.corrAccount,
        director: dto.director,
      },
    });

    // Update BrandCountry with legalEntityId
    const updatedBrandCountry = await this.prisma.brandCountry.update({
      where: {
        brandId_countryId: {
          brandId,
          countryId,
        },
      },
      data: {
        legalEntityId: legalEntity.id,
      },
      include: {
        country: true,
        legalEntity: true,
      },
    });

    return {
      brandCountry: updatedBrandCountry,
    };
  }
}
