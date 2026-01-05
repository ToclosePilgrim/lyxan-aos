import { ApiProperty } from '@nestjs/swagger';
import { CounterpartyOfferType } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class UpdateCounterpartyOfferDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false, description: 'Offer SKU/vendor code' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({
    required: false,
    description: 'Currency code (3 chars, uppercase)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be 3-letter uppercase code',
  })
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  externalRef?: string;

  @ApiProperty({ required: false, enum: CounterpartyOfferType })
  @IsOptional()
  @IsEnum(CounterpartyOfferType)
  offerType?: CounterpartyOfferType;
}

