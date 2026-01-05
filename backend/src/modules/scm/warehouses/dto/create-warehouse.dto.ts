import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WarehouseType } from '@prisma/client';

export class CreateWarehouseDto {
  @ApiProperty({
    description: 'Warehouse name',
    example: 'Main Factory Warehouse',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Unique warehouse code (auto-generated if not provided)',
    example: 'WH-001',
    maxLength: 50,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiProperty({
    description: 'Warehouse type',
    enum: WarehouseType,
    required: false,
  })
  @IsOptional()
  @IsEnum(WarehouseType)
  type?: WarehouseType;

  @ApiProperty({
    description: 'Country ID',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  countryId: string;

  @ApiProperty({
    description: 'City',
    required: false,
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({
    description: 'Warehouse address',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: 'Is warehouse active',
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Notes',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
