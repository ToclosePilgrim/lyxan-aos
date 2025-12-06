import { IsOptional, IsString, IsNotEmpty, IsEnum, IsNumber, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ScmProductType } from '@prisma/client';

export class CreateScmProductDto {
  @IsString()
  @IsNotEmpty()
  internalName: string; // единственное обязательное поле

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  brandId?: string; // ВАЖНО: только IsString, НИКАКИХ IsUUID

  @IsOptional()
  @IsEnum(ScmProductType)
  type?: ScmProductType;

  @IsOptional()
  @IsString()
  baseDescription?: string;

  @IsOptional()
  @IsString()
  composition?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  netWeightGrams?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  grossWeightGrams?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lengthMm?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  widthMm?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  heightMm?: number;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  countryOfOriginCode?: string;

  @IsOptional()
  @IsObject()
  technicalAttributes?: Record<string, unknown>;
}

