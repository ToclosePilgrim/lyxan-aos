import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductionOrderItemDto {
  @ApiProperty({
    description: 'MDM Item ID (component material)',
    example: 'mdm_item_123',
  })
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ description: 'Planned quantity', example: 10 })
  @IsNumber()
  @IsPositive()
  quantityPlanned: number;

  @ApiProperty({ description: 'Unit of measurement', example: 'pcs' })
  @IsString()
  @IsNotEmpty()
  quantityUnit: string;

  @ApiProperty({
    description: 'Expected date (optional)',
    required: false,
    example: '2025-12-31T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiProperty({ description: 'Optional note', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
