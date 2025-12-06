import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseFiltersDto } from './dto/warehouse-filters.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class WarehousesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: WarehouseFiltersDto) {
    const where: Prisma.WarehouseWhereInput = {};

    // Search by name or code (case-insensitive)
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
      ];
    }

    // Filter by active status
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // Filter by country
    if (filters?.countryId) {
      where.countryId = filters.countryId;
    }

    const take = Math.min(Number(filters?.limit) || 50, 100);
    const offset = filters?.offset ?? 0;

    const [warehouses, total] = await Promise.all([
      this.prisma.warehouse.findMany({
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
              stocks: true,
              supplies: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take,
        skip: offset,
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return {
      items: warehouses.map((warehouse) => ({
        id: warehouse.id,
        name: warehouse.name,
        code: warehouse.code,
        type: warehouse.type,
        countryId: warehouse.countryId,
        country: warehouse.country,
        city: warehouse.city,
        address: warehouse.address,
        isActive: warehouse.isActive,
        notes: warehouse.notes,
        createdAt: warehouse.createdAt,
        updatedAt: warehouse.updatedAt,
        stocksCount: warehouse._count.stocks,
        suppliesCount: warehouse._count.supplies,
      })),
      total,
    };
  }

  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
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
            stocks: true,
            supplies: true,
          },
        },
      },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    return {
      id: warehouse.id,
      name: warehouse.name,
      code: warehouse.code,
      type: warehouse.type,
      countryId: warehouse.countryId,
      country: warehouse.country,
      city: warehouse.city,
      address: warehouse.address,
      isActive: warehouse.isActive,
      notes: warehouse.notes,
      createdAt: warehouse.createdAt,
      updatedAt: warehouse.updatedAt,
      stocksCount: warehouse._count.stocks,
      suppliesCount: warehouse._count.supplies,
    };
  }

  async create(dto: CreateWarehouseDto) {
    // Generate code if not provided
    let code = dto.code;
    if (!code) {
      const year = new Date().getFullYear();
      const prefix = `WH-${year}-`;
      const latest = await this.prisma.warehouse.findFirst({
        where: { code: { startsWith: prefix } },
        orderBy: { code: 'desc' },
      });
      let sequence = 1;
      if (latest?.code) {
        const match = latest.code.match(/\d+$/);
        if (match) {
          sequence = parseInt(match[0], 10) + 1;
        }
      }
      code = `${prefix}${sequence.toString().padStart(4, '0')}`;
    }

    // Check if code already exists
    const existing = await this.prisma.warehouse.findUnique({
      where: { code },
    });

    if (existing) {
      throw new BadRequestException(`Warehouse with code ${code} already exists`);
    }

    // Validate country if provided
    if (dto.countryId) {
      const country = await this.prisma.country.findUnique({
        where: { id: dto.countryId },
      });

      if (!country) {
        throw new NotFoundException(`Country with ID ${dto.countryId} not found`);
      }
    }

    return this.prisma.warehouse.create({
      data: {
        name: dto.name,
        code: code,
        type: dto.type || 'OWN',
        countryId: dto.countryId,
        city: dto.city,
        address: dto.address,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        notes: dto.notes,
      },
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
  }

  async update(id: string, dto: UpdateWarehouseDto) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    // Check if code is being changed and if it's already taken
    if (dto.code && dto.code !== warehouse.code) {
      const existing = await this.prisma.warehouse.findUnique({
        where: { code: dto.code },
      });

      if (existing) {
        throw new BadRequestException(`Warehouse with code ${dto.code} already exists`);
      }
    }

    // Validate country if provided
    if (dto.countryId) {
      const country = await this.prisma.country.findUnique({
        where: { id: dto.countryId },
      });

      if (!country) {
        throw new NotFoundException(`Country with ID ${dto.countryId} not found`);
      }
    }

    return this.prisma.warehouse.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        type: dto.type,
        countryId: dto.countryId,
        city: dto.city,
        address: dto.address,
        isActive: dto.isActive,
        notes: dto.notes,
      },
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
  }

  async remove(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }

    // Soft delete: set isActive = false
    return this.prisma.warehouse.update({
      where: { id },
      data: {
        isActive: false,
      },
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
  }
}

