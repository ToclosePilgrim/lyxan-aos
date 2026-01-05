import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class AdjustStockDto {
  @ApiProperty({ description: 'Supplier item ID', example: 'item_123' })
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @ApiProperty({ description: 'Warehouse ID', example: 'wh_123' })
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiProperty({
    description:
      'Quantity to adjust (positive = add stock, negative = remove stock)',
    example: 10,
  })
  @IsNumber()
  quantity!: number;

  @ApiProperty({
    description: 'Unit cost (required when quantity > 0)',
    required: false,
    example: 12.5,
  })
  @ValidateIf((o) => o.quantity > 0)
  @IsNumber()
  unitCost?: number;

  @ApiProperty({
    description: 'Currency (required when quantity > 0)',
    required: false,
    example: 'RUB',
  })
  @ValidateIf((o) => o.quantity > 0)
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Reason for adjustment',
    required: false,
    example: 'Inventory correction',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: 'Effective date/time of adjustment (ISO string)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  effectiveAt?: string;
}

