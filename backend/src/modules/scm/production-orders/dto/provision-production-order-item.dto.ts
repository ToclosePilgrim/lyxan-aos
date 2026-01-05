import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum ProvisionSourceType {
  INVENTORY = 'INVENTORY',
  MANUAL = 'MANUAL',
}

export class ProvisionProductionOrderItemDto {
  @ApiProperty({ description: 'Warehouse ID to provision from' })
  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @ApiProperty({ description: 'Amount to provision (>0)', example: 1 })
  @IsNumber()
  @Min(0.0000001)
  amount: number;

  @ApiProperty({
    enum: ProvisionSourceType,
    description: 'Provision source type',
  })
  @IsEnum(ProvisionSourceType)
  sourceType: ProvisionSourceType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;
}

