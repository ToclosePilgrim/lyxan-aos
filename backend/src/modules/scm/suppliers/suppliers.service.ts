import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { FilterSuppliersDto } from './dto/filter-suppliers.dto';
import { LinkScmProductDto } from './dto/link-scm-product.dto';
import { Prisma, SupplierRole as PrismaSupplierRole } from '@prisma/client';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generate supplier code (e.g., SUP-2025-0001)
   */
  private async generateSupplierCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SUP-${year}-`;

    // Find the latest supplier with this prefix
    const latest = await this.prisma.supplier.findFirst({
      where: {
        code: {
          startsWith: prefix,
        },
      },
      orderBy: {
        code: 'desc',
      },
    });

    let sequence = 1;
    if (latest) {
      const lastSequence = parseInt(latest.code.replace(prefix, ''), 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }

  async findAll(filters: FilterSuppliersDto) {
    const where: Prisma.SupplierWhereInput = {};

    if (filters?.search) {
      where.OR = [
        {
          name: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          code: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          tags: {
            hasSome: [filters.search],
          },
        },
      ];
    }

    if (filters?.types && filters.types.length > 0) {
      // Support filtering by multiple types - check if types array contains any of them
      where.OR = (where.OR || []).concat(
        filters.types.map((type) => ({
          types: {
            has: type,
          },
        })),
      );
    } else if (filters?.type) {
      // Support filtering by type (single value) - check if types array contains it
      where.types = {
        has: filters.type,
      };
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.countryId) {
      where.countryId = filters.countryId;
    }

    const suppliers = await this.prisma.supplier.findMany({
      where,
      include: {
        country: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            scmProductLinks: true,
          },
        },
        legalProfiles: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      types: supplier.types,
      status: supplier.status,
      country: supplier.country,
      suppliesWhat: supplier.suppliesWhat,
      contactPerson: supplier.contactPerson,
      email: supplier.email,
      phone: supplier.phone,
      website: supplier.website,
      legalName: supplier.legalName,
      taxId: supplier.taxId,
      registrationNumber: supplier.registrationNumber,
      legalAddress: supplier.legalAddress,
      bankDetails: supplier.bankDetails,
      bankAccount: supplier.bankAccount,
      corrAccount: supplier.corrAccount,
      bik: supplier.bik,
      bankName: supplier.bankName,
      extraPaymentDetails: supplier.extraPaymentDetails,
      edoSystem: supplier.edoSystem,
      edoNumber: supplier.edoNumber,
      ceoFullName: supplier.ceoFullName,
      tags: supplier.tags,
      notes: supplier.notes,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
      productsCount: supplier._count.scmProductLinks,
    }));
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        country: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        scmProductLinks: {
          include: {
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
          },
        },
        legalProfiles: true,
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return {
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      types: supplier.types,
      status: supplier.status,
      country: supplier.country,
      suppliesWhat: supplier.suppliesWhat,
      contactPerson: supplier.contactPerson,
      email: supplier.email,
      phone: supplier.phone,
      website: supplier.website,
      legalName: supplier.legalName,
      taxId: supplier.taxId,
      registrationNumber: supplier.registrationNumber,
      legalAddress: supplier.legalAddress,
      bankDetails: supplier.bankDetails,
      bankAccount: supplier.bankAccount,
      corrAccount: supplier.corrAccount,
      bik: supplier.bik,
      bankName: supplier.bankName,
      extraPaymentDetails: supplier.extraPaymentDetails,
      edoSystem: supplier.edoSystem,
      edoNumber: supplier.edoNumber,
      ceoFullName: supplier.ceoFullName,
      tags: supplier.tags,
      notes: supplier.notes,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
      scmProductLinks: (supplier.scmProductLinks || []).map((link) => ({
        id: link.id,
        role: link.role,
        isPrimary: link.isPrimary,
        leadTimeDays: link.leadTimeDays,
        minOrderQty: link.minOrderQty,
        purchaseCurrency: link.purchaseCurrency,
        purchasePrice: link.purchasePrice ? link.purchasePrice.toNumber() : null,
        notes: link.notes,
        scmProduct: link.scmProduct ? {
          id: link.scmProduct.id,
          internalName: link.scmProduct.internalName,
          sku: link.scmProduct.sku,
          brand: link.scmProduct.brand ? {
            id: link.scmProduct.brand.id,
            name: link.scmProduct.brand.name,
            code: link.scmProduct.brand.code,
          } : null,
        } : null,
      })),
      legalProfiles: supplier.legalProfiles || [],
    };
  }

  async create(dto: CreateSupplierDto) {
    // Generate code if not provided
    const code = dto.code?.trim() || (await this.generateSupplierCode());

    // Validate country if provided and get countryCode
    let countryCode: string | undefined = dto.countryCode;
    if (dto.countryId) {
      const country = await this.prisma.country.findUnique({
        where: { id: dto.countryId },
      });

      if (!country) {
        throw new NotFoundException(`Country with ID ${dto.countryId} not found`);
      }

      // Use country code from database if not provided in DTO
      if (!countryCode) {
        countryCode = country.code;
      }

      // Validate that countryCode matches the country if both are provided
      if (dto.countryCode && dto.countryCode !== country.code) {
        throw new BadRequestException(
          `Country code ${dto.countryCode} does not match country ${country.code}`,
        );
      }
    }

    // Validate legal details structure based on countryCode
    // Note: Legal details are optional for all countries, including RU
    // If provided, they must match the country structure

    try {
      // Map legal details to Supplier fields and SupplierLegalProfile
      let supplierLegalName: string | undefined;
      let supplierTaxId: string | undefined;
      let supplierRegistrationNumber: string | undefined;
      let supplierLegalAddress: string | undefined;
      let supplierBankDetails: any = null;

      // Priority: new structure > legacy fields
      if (countryCode === 'RU' && dto.russianLegal) {
        // Russian legal details: map to SupplierLegalProfile
        supplierLegalName = dto.russianLegal.legalName;
        supplierLegalAddress = dto.russianLegal.legalAddress;
      } else if (countryCode && countryCode !== 'RU' && dto.legal) {
        // Generic legal details: map to Supplier fields
        supplierLegalName = dto.legal.legalName;
        supplierTaxId = dto.legal.taxId;
        supplierRegistrationNumber = dto.legal.registrationNumber;
        supplierLegalAddress = dto.legal.legalAddress;
        // Safe JSON parsing for bankDetails
        if (dto.legal.bankDetails) {
          if (typeof dto.legal.bankDetails === 'string') {
            const trimmed = dto.legal.bankDetails.trim();
            // Only parse if it looks like JSON (starts with { or [)
            if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.endsWith('}') || trimmed.endsWith(']')) {
              try {
                supplierBankDetails = JSON.parse(trimmed);
              } catch (error) {
                this.logger.warn(`Failed to parse bankDetails as JSON, storing as string: ${error.message}`);
                // Store as string in JSON format
                supplierBankDetails = { raw: dto.legal.bankDetails };
              }
            } else {
              // Not JSON, store as string in JSON format
              supplierBankDetails = { raw: dto.legal.bankDetails };
            }
          } else {
            supplierBankDetails = dto.legal.bankDetails;
          }
        } else {
          supplierBankDetails = null;
        }
      } else {
        // Legacy fields (for backward compatibility)
        supplierLegalName = dto.legalName;
        supplierTaxId = dto.taxId;
        supplierRegistrationNumber = dto.registrationNumber;
        supplierLegalAddress = dto.legalAddress;
        // Safe JSON parsing for bankDetails
        if (dto.bankDetails) {
          if (typeof dto.bankDetails === 'string') {
            const trimmed = dto.bankDetails.trim();
            // Only parse if it looks like JSON (starts with { or [)
            if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && (trimmed.endsWith('}') || trimmed.endsWith(']'))) {
              try {
                supplierBankDetails = JSON.parse(trimmed);
              } catch (error) {
                this.logger.warn(`Failed to parse bankDetails as JSON, storing as string: ${error.message}`);
                // Store as string in JSON format
                supplierBankDetails = { raw: dto.bankDetails };
              }
            } else {
              // Not JSON, store as string in JSON format
              supplierBankDetails = { raw: dto.bankDetails };
            }
          } else {
            supplierBankDetails = dto.bankDetails;
          }
        } else {
          supplierBankDetails = null;
        }
      }

      const data: Prisma.SupplierCreateInput = {
        name: dto.name,
        code: code,
        types: dto.types,
        status: dto.status || 'ACTIVE',
        country: dto.countryId ? { connect: { id: dto.countryId } } : undefined,
        suppliesWhat: dto.suppliesWhat,
        contactPerson: dto.contactPerson,
        email: dto.email,
        phone: dto.phone,
        website: dto.website,
        legalName: supplierLegalName,
        taxId: supplierTaxId,
        registrationNumber: supplierRegistrationNumber,
        legalAddress: supplierLegalAddress,
        bankDetails: supplierBankDetails,
        // Новые поля для банковских реквизитов и ЭДО
        bankAccount: dto.bankAccount,
        corrAccount: dto.corrAccount,
        bik: dto.bik,
        bankName: dto.bankName,
        extraPaymentDetails: dto.extraPaymentDetails,
        edoSystem: dto.edoSystem ?? null,
        edoNumber: dto.edoNumber ?? null,
        ceoFullName: dto.ceoFullName ?? null,
        tags: dto.tags || [],
        notes: dto.notes,
      };

      // Create SupplierLegalProfile if needed
      if (countryCode === 'RU' && dto.russianLegal) {
        const profileData: any = {
          countryCode: 'RU',
          inn: dto.russianLegal.inn,
          legalAddress: dto.russianLegal.legalAddress,
        };

        if (dto.russianLegal.kpp) profileData.kpp = dto.russianLegal.kpp;
        if (dto.russianLegal.ogrn) profileData.ogrn = dto.russianLegal.ogrn;
        if (dto.russianLegal.actualAddress)
          profileData.actualAddress = dto.russianLegal.actualAddress;

        // Bank details (required for Russia)
        if (dto.russianLegal.bankName) profileData.bankName = dto.russianLegal.bankName;
        if (dto.russianLegal.bic) profileData.bankBic = dto.russianLegal.bic;
        if (dto.russianLegal.bankAccount) profileData.bankAccount = dto.russianLegal.bankAccount;
        if (dto.russianLegal.correspondentAccount)
          profileData.bankCorrAccount = dto.russianLegal.correspondentAccount;
        if (dto.russianLegal.bankExtraDetails)
          profileData.bankExtraDetails = dto.russianLegal.bankExtraDetails;

        // Additional legal info
        if (dto.russianLegal.edoSystem) profileData.edoType = dto.russianLegal.edoSystem;
        if (dto.russianLegal.edoNumber) profileData.edoNumber = dto.russianLegal.edoNumber;
        if (dto.russianLegal.ceoFullName) profileData.generalDirector = dto.russianLegal.ceoFullName;

        data.legalProfiles = {
          create: profileData,
        };
      } else if (dto.legalProfile && dto.legalProfile.countryCode) {
        // Legacy legalProfile support
        const profileData: any = {
          countryCode: dto.legalProfile.countryCode,
        };

        if (dto.legalProfile.inn !== undefined)
          profileData.inn = dto.legalProfile.inn;
        if (dto.legalProfile.kpp !== undefined)
          profileData.kpp = dto.legalProfile.kpp;
        if (dto.legalProfile.ogrn !== undefined)
          profileData.ogrn = dto.legalProfile.ogrn;
        if (dto.legalProfile.legalAddress !== undefined)
          profileData.legalAddress = dto.legalProfile.legalAddress;
        if (dto.legalProfile.actualAddress !== undefined)
          profileData.actualAddress = dto.legalProfile.actualAddress;
        if (dto.legalProfile.bankAccount !== undefined)
          profileData.bankAccount = dto.legalProfile.bankAccount;
        if (dto.legalProfile.bankName !== undefined)
          profileData.bankName = dto.legalProfile.bankName;
        if (dto.legalProfile.bankBic !== undefined)
          profileData.bankBic = dto.legalProfile.bankBic;
        if (dto.legalProfile.bankCorrAccount !== undefined)
          profileData.bankCorrAccount = dto.legalProfile.bankCorrAccount;
        if (dto.legalProfile.edoType !== undefined)
          profileData.edoType = dto.legalProfile.edoType;
        if (dto.legalProfile.edoNumber !== undefined)
          profileData.edoNumber = dto.legalProfile.edoNumber;
        if (dto.legalProfile.generalDirector !== undefined)
          profileData.generalDirector = dto.legalProfile.generalDirector;

        data.legalProfiles = {
          create: profileData,
        };
      }

      return await this.prisma.supplier.create({
        data,
        include: {
          country: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          legalProfiles: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Supplier with code ${code} already exists`,
          );
        }
        if (error.code === 'P2003') {
          throw new BadRequestException(
            'Invalid reference: one of the related entities does not exist',
          );
        }
        if (error.code === 'P2011') {
          throw new BadRequestException(
            'Missing required field: ' + error.meta?.target,
          );
        }
      }
      // Log full error for debugging
      this.logger.error('Failed to create supplier', error);
      throw new BadRequestException(
        `Cannot create supplier: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    // Validate country if provided
    if (dto.countryId !== undefined) {
      if (dto.countryId) {
        const country = await this.prisma.country.findUnique({
          where: { id: dto.countryId },
        });

        if (!country) {
          throw new NotFoundException(
            `Country with ID ${dto.countryId} not found`,
          );
        }
      }
    }

    const updateData: Prisma.SupplierUpdateInput = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.code !== undefined) {
      updateData.code = dto.code;
    }
    if (dto.types !== undefined) {
      updateData.types = dto.types;
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }
    if (dto.countryId !== undefined) {
      if (dto.countryId === null) {
        updateData.country = { disconnect: true };
      } else {
        updateData.country = { connect: { id: dto.countryId } };
      }
    }
    if (dto.suppliesWhat !== undefined) {
      updateData.suppliesWhat = dto.suppliesWhat;
    }
    if (dto.contactPerson !== undefined) {
      updateData.contactPerson = dto.contactPerson;
    }
    if (dto.email !== undefined) {
      updateData.email = dto.email;
    }
    if (dto.phone !== undefined) {
      updateData.phone = dto.phone;
    }
    if (dto.website !== undefined) {
      updateData.website = dto.website;
    }
    if (dto.legalName !== undefined) {
      updateData.legalName = dto.legalName;
    }
    if (dto.taxId !== undefined) {
      updateData.taxId = dto.taxId;
    }
    if (dto.registrationNumber !== undefined) {
      updateData.registrationNumber = dto.registrationNumber;
    }
    if (dto.legalAddress !== undefined) {
      updateData.legalAddress = dto.legalAddress;
    }
    if (dto.bankDetails !== undefined) {
      if (dto.bankDetails) {
        if (typeof dto.bankDetails === 'string') {
          const trimmed = dto.bankDetails.trim();
          // Only parse if it looks like JSON (starts with { or [)
          if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && (trimmed.endsWith('}') || trimmed.endsWith(']'))) {
            try {
              updateData.bankDetails = JSON.parse(trimmed);
            } catch (error) {
              this.logger.warn(`Failed to parse bankDetails as JSON, storing as string: ${error.message}`);
              updateData.bankDetails = { raw: dto.bankDetails };
            }
          } else {
            // Not JSON, store as string in JSON format
            updateData.bankDetails = { raw: dto.bankDetails };
          }
        } else {
          updateData.bankDetails = dto.bankDetails;
        }
      } else {
        updateData.bankDetails = Prisma.JsonNull;
      }
    }
    // Новые поля для банковских реквизитов и ЭДО
    if (dto.bankAccount !== undefined) {
      updateData.bankAccount = dto.bankAccount;
    }
    if (dto.corrAccount !== undefined) {
      updateData.corrAccount = dto.corrAccount;
    }
    if (dto.bik !== undefined) {
      updateData.bik = dto.bik;
    }
    if (dto.bankName !== undefined) {
      updateData.bankName = dto.bankName;
    }
    if (dto.extraPaymentDetails !== undefined) {
      updateData.extraPaymentDetails = dto.extraPaymentDetails;
    }
    if (dto.edoSystem !== undefined) {
      updateData.edoSystem = dto.edoSystem;
    }
    if (dto.edoNumber !== undefined) {
      updateData.edoNumber = dto.edoNumber;
    }
    if (dto.ceoFullName !== undefined) {
      updateData.ceoFullName = dto.ceoFullName;
    }
    if (dto.tags !== undefined) {
      updateData.tags = dto.tags || [];
    }
    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    try {
      const updatedSupplier = await this.prisma.supplier.update({
        where: { id },
        data: updateData,
        include: {
          country: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      // Handle legal profile update/create
      if (dto.legalProfile && dto.legalProfile.countryCode) {
        const p = dto.legalProfile;
        const profileData: any = {};
        
        // Only include fields that are actually provided (not undefined)
        if (p.inn !== undefined) profileData.inn = p.inn;
        if (p.kpp !== undefined) profileData.kpp = p.kpp;
        if (p.ogrn !== undefined) profileData.ogrn = p.ogrn;
        if (p.legalAddress !== undefined) profileData.legalAddress = p.legalAddress;
        if (p.actualAddress !== undefined) profileData.actualAddress = p.actualAddress;
        if (p.bankAccount !== undefined) profileData.bankAccount = p.bankAccount;
        if (p.bankName !== undefined) profileData.bankName = p.bankName;
        if (p.bankBic !== undefined) profileData.bankBic = p.bankBic;
        if (p.bankCorrAccount !== undefined) profileData.bankCorrAccount = p.bankCorrAccount;
        if (p.edoType !== undefined) profileData.edoType = p.edoType;
        if (p.edoNumber !== undefined) profileData.edoNumber = p.edoNumber;
        if (p.generalDirector !== undefined) profileData.generalDirector = p.generalDirector;
        
        await this.prisma.supplierLegalProfile.upsert({
          where: {
            supplierId_countryCode: {
              supplierId: id,
              countryCode: p.countryCode,
            } as any,
          },
          create: {
            supplierId: id,
            countryCode: p.countryCode,
            ...profileData,
          },
          update: profileData,
        });
      }

      // Return supplier with legal profiles
      return await this.prisma.supplier.findUnique({
        where: { id },
        include: {
          country: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          legalProfiles: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Supplier with code ${dto.code} already exists`,
          );
        }
      }
      throw error;
    }
  }

  async remove(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            scmProductLinks: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    // Soft delete: set status to INACTIVE instead of hard delete
    if (supplier._count.scmProductLinks > 0) {
      return await this.prisma.supplier.update({
        where: { id },
        data: {
          status: 'INACTIVE',
        },
      });
    }

    // Hard delete if no product links
    return await this.prisma.supplier.delete({
      where: { id },
    });
  }

  async linkScmProduct(id: string, dto: LinkScmProductDto) {
    // Verify supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    // Verify SCM product exists
    const scmProduct = await this.prisma.scmProduct.findUnique({
      where: { id: dto.scmProductId },
    });

    if (!scmProduct) {
      throw new NotFoundException(
        `SCM product with ID ${dto.scmProductId} not found`,
      );
    }

    try {
      // Convert shared enum to Prisma enum (they should match, but TypeScript needs explicit cast)
      const prismaRole = dto.role as PrismaSupplierRole;
      
      return await this.prisma.scmProductSupplier.create({
        data: {
          scmProductId: dto.scmProductId,
          supplierId: id,
          role: prismaRole,
          isPrimary: dto.isPrimary || false,
          leadTimeDays: dto.leadTimeDays,
          minOrderQty: dto.minOrderQty,
          purchaseCurrency: dto.purchaseCurrency,
          purchasePrice: dto.purchasePrice ? dto.purchasePrice : null,
          notes: dto.notes,
        },
        include: {
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
          supplier: {
            select: {
              id: true,
              name: true,
              types: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            `Link between supplier and SCM product already exists`,
          );
        }
      }
      throw error;
    }
  }

  async unlinkScmProduct(id: string, scmProductId: string) {
    // Verify supplier exists
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    const link = await this.prisma.scmProductSupplier.findFirst({
      where: {
        supplierId: id,
        scmProductId: scmProductId,
      },
    });

    if (!link) {
      throw new NotFoundException(
        `Link between supplier and SCM product not found`,
      );
    }

    return await this.prisma.scmProductSupplier.delete({
      where: { id: link.id },
    });
  }
}

