import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
  IsISO8601,
} from 'class-validator';

export class SupplyPartialReceiveItemDto {
  @ApiProperty({ description: 'Supply item ID', example: 'item_123' })
  @IsString()
  @IsNotEmpty()
  supplyItemId: string;

  @ApiProperty({ description: 'Quantity to receive', example: 50 })
  @IsNumber()
  @IsPositive()
  quantity: number;

  @ApiProperty({ description: 'Price per unit for this receipt', example: 3.5 })
  @IsNumber()
  @IsPositive()
  pricePerUnit: number;

  @ApiProperty({ description: 'Currency code', example: 'USD' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({
    description: 'Datetime of receipt',
    required: false,
    example: '2025-12-10T10:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  receivedAt?: string;

  @ApiProperty({ description: 'Optional comment', required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class PartialSupplyReceiveDto {
  @ApiProperty({ type: [SupplyPartialReceiveItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplyPartialReceiveItemDto)
  items: SupplyPartialReceiveItemDto[];
}

