import { IsString, IsNotEmpty, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFinanceReportDto {
  @ApiProperty({
    description: 'SKU ID',
    example: 'sku-id',
  })
  @IsString()
  @IsNotEmpty()
  skuId: string;

  @ApiProperty({
    description: 'Date of the report (ISO date string)',
    example: '2025-01-15',
  })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({
    description: 'Quantity sold',
    example: 10,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({
    description: 'Revenue',
    example: 10000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  revenue: number;

  @ApiProperty({
    description: 'Commission',
    example: 1500,
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  commission?: number;

  @ApiProperty({
    description: 'Refunds',
    example: 500,
    minimum: 0,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  refunds?: number;
}







