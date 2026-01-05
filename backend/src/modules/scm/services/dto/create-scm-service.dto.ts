import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsPositive,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ScmServiceCategory } from '@prisma/client';

export class CreateScmServiceDto {
  @ApiProperty({
    description: 'Supplier ID (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({
    description: 'Service category',
    enum: ScmServiceCategory,
  })
  @IsEnum(ScmServiceCategory)
  @IsNotEmpty()
  category: ScmServiceCategory;

  @ApiProperty({
    description: 'Service name',
    example: 'Производство партии',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Production Order ID (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @ApiProperty({
    description: 'Supply ID (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  supplyId?: string;

  @ApiProperty({
    description: 'Quantity (if applicable)',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @ApiProperty({
    description: 'Unit of measurement',
    required: false,
    example: 'услуга',
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({
    description: 'Price per unit',
    required: false,
    example: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerUnit?: number;

  @ApiProperty({
    description: 'Total amount',
    example: 1000,
  })
  @IsNumber()
  @Min(0)
  totalAmount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'RUB',
  })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({
    description: 'Financial Document ID (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  financialDocumentId?: string;

  @ApiProperty({
    description: 'Comment',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

