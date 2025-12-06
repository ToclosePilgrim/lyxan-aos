import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateLegalEntityDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  inn?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  kpp?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  ogrn?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  legalAddr?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  bankName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  bik?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  account?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  corrAccount?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  director?: string;
}





