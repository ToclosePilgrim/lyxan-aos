import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { SalesDocumentStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class ListSalesDocumentsDto {
  @IsString()
  @IsNotEmpty()
  countryId: string;

  @IsString()
  @IsNotEmpty()
  brandId: string;

  @IsOptional()
  @IsEnum(SalesDocumentStatus)
  status?: SalesDocumentStatus;

  @IsOptional()
  @IsString()
  marketplaceId?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsDateString()
  periodFrom?: string;

  @IsOptional()
  @IsDateString()
  periodTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offset?: number;
}
