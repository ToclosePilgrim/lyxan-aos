import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * Russian legal details (for countryCode = 'RU')
 */
export class RussianLegalDetailsDto {
  @IsString()
  @IsNotEmpty()
  legalName: string;

  @IsString()
  @IsNotEmpty()
  inn: string;

  @IsOptional()
  @IsString()
  kpp?: string;

  @IsOptional()
  @IsString()
  ogrn?: string;

  @IsString()
  @IsNotEmpty()
  legalAddress: string;

  @IsOptional()
  @IsString()
  actualAddress?: string;

  // Bank details (required for Russia)
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @IsString()
  @IsNotEmpty()
  bic: string; // БИК

  @IsString()
  @IsNotEmpty()
  bankAccount: string; // р/с

  @IsOptional()
  @IsString()
  correspondentAccount?: string; // кор/с

  @IsOptional()
  @IsString()
  bankExtraDetails?: string; // доп. информация по оплатам

  // Additional legal info
  @IsOptional()
  @IsString()
  edoSystem?: string; // ЭДО система (например "СБИС", "Диадок")

  @IsOptional()
  @IsString()
  edoNumber?: string; // Адрес/ID в системе ЭДО

  @IsOptional()
  @IsString()
  ceoFullName?: string; // ФИО Генерального директора
}

