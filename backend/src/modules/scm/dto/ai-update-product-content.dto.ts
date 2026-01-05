import { IsOptional, IsString, MaxLength } from 'class-validator';

// LEGACY DTO: legacy Product content. Deprecated, do not use in new code.

export class AiUpdateProductContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mpTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  mpShortDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  mpDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  keywords?: string;

  @IsOptional()
  contentAttributes?: Record<string, unknown>;
}
