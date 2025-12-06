import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScmSupplyItemDto {
  @ApiProperty({
    description: 'Supplier Item ID (optional)',
    required: false,
    example: 'si1',
  })
  @IsOptional()
  @IsString()
  supplierItemId?: string;

  @ApiProperty({
    description: 'Product ID (optional)',
    required: false,
    example: 'prod1',
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({
    description: 'Description (if no supplier item or product)',
    required: false,
    example: 'Custom item description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'pcs',
  })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty({
    description: 'Ordered quantity',
    example: 1000,
  })
  @IsNumber()
  @Min(0)
  quantityOrdered: number;

  @ApiProperty({
    description: 'Received quantity',
    required: false,
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityReceived?: number;

  @ApiProperty({
    description: 'Price per unit',
    example: 10.5,
  })
  @IsNumber()
  @Min(0)
  pricePerUnit: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'RUB',
  })
  @IsString()
  @IsNotEmpty()
  currency: string;
}
