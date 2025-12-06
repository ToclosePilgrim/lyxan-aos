import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsEmail,
  IsUrl,
  IsArray,
  ArrayNotEmpty,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SupplierType, SupplierStatus } from '@prisma/client';
import { SupplierLegalProfileDto } from './supplier-legal-profile.dto';
import { GenericLegalDetailsDto } from './generic-legal-details.dto';
import { RussianLegalDetailsDto } from './russian-legal-details.dto';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(SupplierType, { each: true })
  types: SupplierType[];

  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;

  @IsOptional()
  @IsString()
  countryId?: string;

  // countryCode is used to determine which legal details structure to use
  // It should match the code of the country selected via countryId
  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  suppliesWhat?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  // Legacy fields - kept for backward compatibility but deprecated
  // Use 'legal' or 'russianLegal' instead
  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  legalAddress?: string;

  @IsOptional()
  bankDetails?: any; // JSON object - legacy, для обратной совместимости

  // Банковские реквизиты (отдельные поля)
  @IsOptional()
  @IsString()
  bankAccount?: string; // расчётный счёт

  @IsOptional()
  @IsString()
  corrAccount?: string; // корр. счёт

  @IsOptional()
  @IsString()
  bik?: string; // BIC

  @IsOptional()
  @IsString()
  bankName?: string; // название банка

  @IsOptional()
  @IsString()
  extraPaymentDetails?: string; // доп. платёжная инфа

  // ЭДО и доп. юр. инфо
  @IsOptional()
  @IsString()
  edoSystem?: string; // система ЭДО (например: "Тензор СБИС")

  @IsOptional()
  @IsString()
  edoNumber?: string; // идентификатор/адрес ЭДО

  @IsOptional()
  @IsString()
  ceoFullName?: string; // ФИО гендиректора

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  // New structure: generic legal details for non-RU countries
  @ValidateIf((o) => o.countryCode && o.countryCode !== 'RU')
  @ValidateNested()
  @Type(() => GenericLegalDetailsDto)
  legal?: GenericLegalDetailsDto;

  // New structure: Russian legal details for RU
  @ValidateIf((o) => o.countryCode === 'RU')
  @ValidateNested()
  @Type(() => RussianLegalDetailsDto)
  russianLegal?: RussianLegalDetailsDto;

  // Legacy field - kept for backward compatibility
  @IsOptional()
  @Type(() => SupplierLegalProfileDto)
  legalProfile?: SupplierLegalProfileDto;
}

