import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProductionOrderStatus } from '@prisma/client';

export class CreateProductionOrderDto {
  @ApiProperty({
    description: 'SCM Product ID',
    example: 'prod1',
  })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'Planned quantity to produce',
    example: 5000,
  })
  @IsNumber()
  @IsPositive()
  quantityPlanned: number;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'pcs',
  })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty({
    description: 'Order code (auto-generated if not provided)',
    required: false,
    example: 'PR-2025-0001',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    description: 'Order status',
    enum: ProductionOrderStatus,
    required: false,
    default: ProductionOrderStatus.PLANNED,
  })
  @IsOptional()
  @IsEnum(ProductionOrderStatus)
  status?: ProductionOrderStatus;

  @ApiProperty({
    description: 'Order name (auto-generated if not provided)',
    required: false,
    example: 'Vimty Retinol RU — партия 5000 шт',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Planned start date',
    required: false,
    example: '2025-12-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  plannedStartAt?: string;

  @ApiProperty({
    description: 'Planned end date',
    required: false,
    example: '2025-12-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  plannedEndAt?: string;

  @ApiProperty({
    description: 'Production site description',
    required: false,
    example: 'Завод X, Россия',
  })
  @IsOptional()
  @IsString()
  productionSite?: string;

  @ApiProperty({
    description: 'Notes/comments',
    required: false,
    example: 'Пилотная партия',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Production country ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  productionCountryId?: string;

  @ApiProperty({
    description: 'Manufacturer (supplier) ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  manufacturerId?: string;
}

