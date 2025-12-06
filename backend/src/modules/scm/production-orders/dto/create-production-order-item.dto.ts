import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductionOrderItemDto {
  @ApiProperty({
    description: 'Supplier Item ID',
    example: 'si1',
  })
  @IsString()
  @IsNotEmpty()
  supplierItemId: string;

  @ApiProperty({
    description: 'Planned quantity',
    example: 5200,
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
  quantityUnit: string;

  @ApiProperty({
    description: 'Expected delivery date',
    required: false,
    example: '2025-12-05T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiProperty({
    description: 'Note/comment',
    required: false,
    example: 'Флаконы, с запасом 4%',
  })
  @IsOptional()
  @IsString()
  note?: string;
}




