import { IsString, IsOptional, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class WarehouseFiltersDto {
  @ApiProperty({
    description: 'Search by name or code (case-insensitive)',
    required: false,
    example: 'main',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by active status',
    required: false,
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Filter by country ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  countryId?: string;

  @ApiProperty({
    description: 'Limit number of results (will be clamped to 100)',
    required: false,
    default: 50,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiProperty({
    description: 'Offset for pagination',
    required: false,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;
}

