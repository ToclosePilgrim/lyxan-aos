import { IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator';

// LEGACY DTO: legacy Product/Sku model. Deprecated, do not use in new code.

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsOptional()
  brandId?: string;

  @IsString()
  @IsOptional()
  scmProductId?: string;

  @IsString()
  @IsOptional()
  marketplaceId?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  fullDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  keywords?: string;

  @IsOptional()
  @IsBoolean()
  saveVersion?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mpTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mpSubtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  mpShortDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  mpDescription?: string;

  @IsOptional()
  contentAttributes?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  aiContentEnabled?: boolean;
}
