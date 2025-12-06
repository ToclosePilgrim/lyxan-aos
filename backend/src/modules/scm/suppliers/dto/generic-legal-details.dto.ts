import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * Generic legal details for non-RU countries
 */
export class GenericLegalDetailsDto {
  @IsString()
  @IsNotEmpty()
  legalName: string;

  @IsString()
  @IsNotEmpty()
  taxId: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsString()
  @IsNotEmpty()
  legalAddress: string;

  @IsOptional()
  @IsString()
  bankDetails?: string;
}




