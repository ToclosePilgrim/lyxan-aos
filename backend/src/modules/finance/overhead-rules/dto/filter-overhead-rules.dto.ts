import { ApiProperty } from '@nestjs/swagger';
import { IsBooleanString, IsEnum, IsOptional, IsString } from 'class-validator';
import { OverheadAllocationMethod, OverheadScope } from '@prisma/client';

export class FilterOverheadRulesDto {
  @ApiProperty({ required: false, enum: OverheadScope })
  @IsOptional()
  @IsEnum(OverheadScope)
  scope?: OverheadScope;

  @ApiProperty({ required: false, enum: OverheadAllocationMethod })
  @IsOptional()
  @IsEnum(OverheadAllocationMethod)
  method?: OverheadAllocationMethod;

  @ApiProperty({ required: false, description: 'true/false' })
  @IsOptional()
  @IsBooleanString()
  isActive?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  countryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;
}




