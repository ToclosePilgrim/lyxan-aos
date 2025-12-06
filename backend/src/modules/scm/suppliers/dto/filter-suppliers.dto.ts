import { IsOptional, IsString, IsEnum, IsArray } from 'class-validator';
import { SupplierType, SupplierStatus } from '@prisma/client';

export class FilterSuppliersDto {
  @IsOptional()
  @IsString()
  search?: string; // имя/код/теги

  @IsOptional()
  @IsEnum(SupplierType)
  type?: SupplierType;

  @IsOptional()
  @IsArray()
  @IsEnum(SupplierType, { each: true })
  types?: SupplierType[];

  @IsOptional()
  @IsString()
  countryId?: string;

  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;
}


