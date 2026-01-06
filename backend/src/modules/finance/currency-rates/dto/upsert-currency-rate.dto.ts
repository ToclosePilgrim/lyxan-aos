import { ApiProperty } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UpsertCurrencyRateDto {
  @ApiProperty({ example: 'EUR', description: 'ISO 4217 currency code' })
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiProperty({
    example: '2025-12-08',
    description: 'UTC date the rate applies to',
  })
  @IsISO8601()
  rateDate: string;

  @ApiProperty({
    example: 1.1,
    description: 'How much base currency equals 1 unit of this currency',
  })
  @IsNumber()
  rateToBase: number;

  @ApiProperty({ example: 'manual', required: false })
  @IsOptional()
  @IsString()
  source?: string;
}




