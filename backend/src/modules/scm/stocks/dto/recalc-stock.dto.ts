import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class RecalcScopeDto {
  @ApiPropertyOptional({ description: 'Filter by warehouse ID' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Filter by item ID (supplier item id)' })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({
    description: 'From date (ISO8601) to include movements',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({
    description: 'To date (ISO8601) to include movements',
  })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class RecalcStockDto {
  @ApiPropertyOptional({
    description: 'Scope for recalculation',
    type: RecalcScopeDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecalcScopeDto)
  scope?: RecalcScopeDto;

  @ApiPropertyOptional({
    description: 'If true, only calculate and report without mutations',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  dryRun?: boolean = true;
}




