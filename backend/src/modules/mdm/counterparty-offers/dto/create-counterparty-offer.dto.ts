import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CounterpartyOfferType } from '@prisma/client';

export class CreateCounterpartyOfferDto {
  @ApiProperty({ description: 'Legal Entity ID', example: 'le_123' })
  @IsString()
  @IsNotEmpty()
  legalEntityId: string;

  @ApiProperty({ description: 'MDM Counterparty ID', example: 'cp_123' })
  @IsString()
  @IsNotEmpty()
  counterpartyId: string;

  @ApiProperty({
    description:
      'MDM Item ID (optional). If omitted, itemType/itemName are used to auto-create an item.',
    required: false,
    example: 'item_123',
  })
  @IsOptional()
  @IsString()
  mdmItemId?: string;

  @ApiProperty({
    description: 'Item type to create when mdmItemId is omitted',
    enum: CounterpartyOfferType,
    required: false,
    example: CounterpartyOfferType.MATERIAL,
  })
  @IsOptional()
  @IsEnum(CounterpartyOfferType)
  itemType?: CounterpartyOfferType;

  @ApiProperty({
    description: 'Item name to create when mdmItemId is omitted',
    required: false,
    example: 'Steel 304 sheet',
  })
  @IsOptional()
  @IsString()
  itemName?: string;

  @ApiProperty({
    description: 'Item SKU/code to create when mdmItemId is omitted (optional)',
    required: false,
    example: 'STEEL-304-1MM',
  })
  @IsOptional()
  @IsString()
  itemSku?: string;

  @ApiProperty({
    description: 'Offer type (defaults to itemType or inferred from mdmItemId)',
    enum: CounterpartyOfferType,
    required: false,
  })
  @IsOptional()
  @IsEnum(CounterpartyOfferType)
  offerType?: CounterpartyOfferType;

  @ApiProperty({
    description: 'Offer name (defaults to itemName if omitted)',
    required: false,
    example: 'Steel 304 sheet — Supplier X',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Offer SKU/vendor code (optional)',
    required: false,
    example: 'VSKU-123',
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({
    description: 'Currency code (3 chars, uppercase)',
    example: 'RUB',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be 3-letter uppercase code',
  })
  currency: string;

  @ApiProperty({
    description: 'Price (optional)',
    required: false,
    example: 10.5,
  })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty({
    description:
      'External reference (optional; enables idempotency per (legalEntityId,counterpartyId,externalRef))',
    required: false,
    example: 'ext-1',
  })
  @IsOptional()
  @IsString()
  externalRef?: string;
}




