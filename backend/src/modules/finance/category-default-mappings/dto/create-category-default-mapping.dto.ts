import { ApiProperty } from '@nestjs/swagger';
import { FinanceCategoryMappingSourceType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCategoryDefaultMappingDto {
  @ApiProperty({
    required: false,
    description: 'LegalEntity scope; null means global default',
  })
  @IsOptional()
  @IsString()
  legalEntityId?: string;

  @ApiProperty({ enum: FinanceCategoryMappingSourceType })
  @IsEnum(FinanceCategoryMappingSourceType)
  sourceType: FinanceCategoryMappingSourceType;

  @ApiProperty({ description: 'Source code (e.g. RENT, MARKETPLACE_FEE)' })
  @IsString()
  @IsNotEmpty()
  sourceCode: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  defaultCashflowCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  defaultPnlCategoryId?: string;

  @ApiProperty({ required: false, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

