import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductionOrderServiceDto {
  @ApiProperty({ description: 'Supplier ID', example: 'supplier-id' })
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty({
    description: 'Supplier service catalog ID (optional)',
    required: false,
    example: 'supplier-service-id',
  })
  @IsOptional()
  @IsString()
  supplierServiceId?: string;

  @ApiProperty({ description: 'Service name', example: 'Packaging' })
  @IsString()
  @IsNotEmpty()
  serviceName: string;

  @ApiProperty({
    description: 'Unit of measurement',
    required: false,
    example: 'pcs',
  })
  @IsOptional()
  @IsString()
  unit?: string;

  @Type(() => Number)
  @ApiProperty({ description: 'Quantity', example: 10 })
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @Type(() => Number)
  @ApiProperty({ description: 'Unit price', example: 5 })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({ description: 'Currency ISO code', example: 'USD' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({
    description: 'Optional notes',
    required: false,
    example: 'Night shift surcharge included',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
