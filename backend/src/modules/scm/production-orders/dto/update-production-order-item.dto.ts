import {
  IsString,
  IsOptional,
  IsNumber,
  IsPositive,
  Min,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProductionOrderItemStatus } from '@prisma/client';

export class UpdateProductionOrderItemDto {
  @ApiProperty({
    description: 'Item status',
    enum: ProductionOrderItemStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ProductionOrderItemStatus)
  status?: ProductionOrderItemStatus;

  @ApiProperty({
    description: 'Planned quantity',
    required: false,
    example: 5200,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantityPlanned?: number;

  @ApiProperty({
    description: 'Received quantity',
    required: false,
    example: 5000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityReceived?: number;

  @ApiProperty({
    description: 'Unit of measurement',
    required: false,
    example: 'pcs',
  })
  @IsOptional()
  @IsString()
  quantityUnit?: string;

  @ApiProperty({
    description: 'Expected delivery date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiProperty({
    description: 'Actual received date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @ApiProperty({
    description: 'Note/comment',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}

