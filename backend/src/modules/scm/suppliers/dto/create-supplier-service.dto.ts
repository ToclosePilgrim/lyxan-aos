import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SupplierServiceCategory } from '@prisma/client';

export class CreateSupplierServiceDto {
  @ApiProperty({
    description: 'Service name',
    example: 'Label application',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Internal code (must be unique within supplier)',
    required: false,
    example: 'LABEL-APP',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    description: 'Service category',
    enum: SupplierServiceCategory,
    example: 'PRODUCTION',
    default: 'OTHER',
  })
  @IsOptional()
  @IsEnum(SupplierServiceCategory)
  category?: SupplierServiceCategory;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'pcs',
  })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty({
    description: 'Base price',
    required: false,
    example: 5.00,
  })
  @IsOptional()
  @IsNumber()
  basePrice?: number;

  @ApiProperty({
    description: 'Currency code',
    required: false,
    example: 'RUB',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Is service active',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Additional notes',
    required: false,
    example: 'Service includes quality control',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}




