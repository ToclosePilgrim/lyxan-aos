import { ApiProperty } from '@nestjs/swagger';
import { FinanceCategoryMappingSourceType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListCategoryDefaultMappingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  legalEntityId?: string;

  @ApiProperty({ required: false, enum: FinanceCategoryMappingSourceType })
  @IsOptional()
  @IsEnum(FinanceCategoryMappingSourceType)
  sourceType?: FinanceCategoryMappingSourceType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sourceCode?: string;

  @ApiProperty({
    required: false,
    description: 'Include archived (isActive=false)',
    default: false,
  })
  @IsOptional()
  @IsString()
  includeInactive?: string;
}




