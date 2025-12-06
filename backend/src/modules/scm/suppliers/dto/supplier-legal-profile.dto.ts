import { IsOptional, IsString } from 'class-validator';

export class SupplierLegalProfileDto {
  @IsString()
  countryCode: string; // "RU"

  @IsOptional()
  @IsString()
  inn?: string;

  @IsOptional()
  @IsString()
  kpp?: string;

  @IsOptional()
  @IsString()
  ogrn?: string;

  @IsOptional()
  @IsString()
  legalAddress?: string;

  @IsOptional()
  @IsString()
  actualAddress?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankBic?: string;

  @IsOptional()
  @IsString()
  bankCorrAccount?: string;

  @IsOptional()
  @IsString()
  edoType?: string;

  @IsOptional()
  @IsString()
  edoNumber?: string;

  @IsOptional()
  @IsString()
  generalDirector?: string;
}





