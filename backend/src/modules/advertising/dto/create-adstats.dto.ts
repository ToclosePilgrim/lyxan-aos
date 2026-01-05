import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAdStatsDto {
  @ApiProperty({
    description: 'Campaign ID',
    example: 'campaign-id',
  })
  @IsString()
  @IsNotEmpty()
  campaignId: string;

  @ApiProperty({
    description: 'Date of statistics (ISO date string)',
    example: '2025-01-15',
  })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({
    description: 'Impressions',
    example: 10000,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  impressions?: number;

  @ApiProperty({
    description: 'Clicks',
    example: 500,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  clicks?: number;

  @ApiProperty({
    description: 'Spend',
    example: 5000,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  spend?: number;

  @ApiProperty({
    description: 'Orders',
    example: 50,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  orders?: number;

  @ApiProperty({
    description: 'Revenue',
    example: 50000,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  revenue?: number;
}

