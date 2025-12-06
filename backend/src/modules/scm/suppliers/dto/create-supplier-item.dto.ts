import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SupplierItemType, SupplierItemCategory } from '@prisma/client';

export class CreateSupplierItemDto {
  @ApiProperty({
    description: 'Item name',
    example: 'Glass bottle 30ml',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Internal code (must be unique within supplier)',
    example: 'BOTTLE-30ML',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    description: 'Item type',
    enum: SupplierItemType,
    example: 'MATERIAL',
  })
  @IsEnum(SupplierItemType)
  type: SupplierItemType;

  @ApiProperty({
    description: 'Item category',
    enum: SupplierItemCategory,
    example: 'PACKAGING',
  })
  @IsEnum(SupplierItemCategory)
  category: SupplierItemCategory;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'pcs',
  })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty({
    description: 'Item description',
    required: false,
    example: 'Clear glass bottle with dropper cap',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Additional notes',
    required: false,
    example: 'Special handling required',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'SKU / product code from supplier',
    required: false,
    example: 'GB-30-DR',
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({
    description: 'Currency code',
    required: false,
    example: 'RUB',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Base price',
    required: false,
    example: 15.50,
  })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty({
    description: 'Minimum order quantity',
    required: false,
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  minOrderQty?: number;

  @ApiProperty({
    description: 'Lead time in days',
    required: false,
    example: 14,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

  @ApiProperty({
    description: 'Is item active',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

