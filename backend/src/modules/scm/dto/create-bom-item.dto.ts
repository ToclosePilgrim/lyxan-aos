import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  IsPositive,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBomItemDto {
  @ApiProperty({
    description: 'Supplier Item ID',
    example: 'supitem1',
  })
  @IsString()
  @IsNotEmpty()
  supplierItemId: string;

  @ApiProperty({
    description: 'Quantity per unit of product',
    example: 1,
  })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'pcs',
  })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiProperty({
    description: 'Wastage percentage (0-100)',
    required: false,
    example: 2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  wastagePercent?: number;

  @ApiProperty({
    description: 'Is this component optional',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isOptional?: boolean;

  @ApiProperty({
    description: 'Note/comment about this component',
    required: false,
    example: 'Flakon стеклянный',
  })
  @IsOptional()
  @IsString()
  note?: string;
}




