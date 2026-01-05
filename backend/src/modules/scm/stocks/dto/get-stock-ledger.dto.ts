import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GetStockLedgerDto {
  @ApiPropertyOptional({ description: 'Filter by warehouse ID' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Filter by item ID (supplier item id)' })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({
    description: 'Filter by movement type (MovementType enum value)',
  })
  @IsOptional()
  @IsString()
  movementType?: string;

  @ApiPropertyOptional({ description: 'Created from date (ISO8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Created to date (ISO8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: 'Page number (default 1)' })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ description: 'Items per page (default 50, max 200)' })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limit: number = 50;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['createdAt:asc', 'createdAt:desc'],
    default: 'createdAt:desc',
  })
  @IsOptional()
  @IsIn(['createdAt:asc', 'createdAt:desc'])
  sort: 'createdAt:asc' | 'createdAt:desc' = 'createdAt:desc';
}

