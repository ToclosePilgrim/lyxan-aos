import { IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProductionOrderStatus } from '@prisma/client';

export class FilterProductionOrdersDto {
  @ApiProperty({
    description:
      'Filter by status (can be multiple, comma-separated string or array)',
    required: false,
    isArray: true,
    enum: ProductionOrderStatus,
  })
  @IsOptional()
  status?: string | ProductionOrderStatus[];

  @ApiProperty({
    description: 'Filter by product ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({
    description: 'Filter by date from (plannedStartAt or createdAt)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({
    description: 'Filter by date to (plannedStartAt or createdAt)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({
    description: 'Search by code or name',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Page number (for pagination)',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiProperty({
    description: 'Page size (for pagination)',
    required: false,
    example: 20,
  })
  @IsOptional()
  @IsString()
  pageSize?: string;

  @ApiProperty({
    description: 'Limit number of results (will be clamped to 100)',
    required: false,
    example: 50,
    minimum: 1,
  })
  @IsOptional()
  @IsString()
  limit?: string;
}
