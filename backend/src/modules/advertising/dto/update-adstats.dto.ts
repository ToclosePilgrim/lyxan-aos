import { IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAdStatsDto {
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




