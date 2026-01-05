import {
  IsString,
  IsOptional,
  IsNumber,
  IsPositive,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateScmSupplyItemDto {
  @ApiProperty({
    description:
      'Offer ID (CounterpartyOffer) OR itemId (exactly one required)',
    required: false,
  })
  @IsString()
  @IsOptional()
  offerId?: string;

  @ApiProperty({
    description:
      'MDM Item ID (for non-material lines); exactly one of offerId/itemId',
    required: false,
  })
  @IsString()
  @IsOptional()
  itemId?: string;

  @ApiProperty({
    description: 'Optional line description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Ordered quantity',
    example: 1000,
  })
  @IsNumber()
  @IsPositive()
  quantityOrdered: number;

  @ApiProperty({
    description: 'Already received quantity (optional, defaults 0)',
    required: false,
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantityReceived?: number;

  @ApiProperty({
    description: 'Unit of measurement',
    example: 'pcs',
  })
  @IsString()
  unit: string;

  @ApiProperty({
    description: 'Price per unit',
    required: false,
    example: 10.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerUnit?: number;

  @ApiProperty({
    description: 'Currency code',
    required: false,
    example: 'RUB',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Production Order Item ID (if linked to production order)',
    required: false,
  })
  @IsOptional()
  @IsString()
  productionOrderItemId?: string;

  @ApiProperty({
    required: false,
    description: 'Logistics cost (total, optional)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  logisticsCost?: number;

  @ApiProperty({
    required: false,
    description: 'Customs cost (total, optional)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  customsCost?: number;

  @ApiProperty({
    required: false,
    description: 'Inbound cost (total, optional)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  inboundCost?: number;
}
