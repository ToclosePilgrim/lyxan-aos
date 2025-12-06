import { IsOptional, IsString, ValidateIf, IsEnum } from 'class-validator';
import { ScmProductType } from '@prisma/client';

export class UpdateScmProductDto {
  @IsOptional()
  @IsString()
  internalName?: string;

  @IsOptional()
  @ValidateIf((o) => o.sku !== null)
  @IsString()
  sku?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.brandId !== null)
  @IsString()
  brandId?: string | null;

  @IsOptional()
  @IsEnum(ScmProductType)
  type?: ScmProductType;

  @IsOptional()
  @ValidateIf((o) => o.baseDescription !== null)
  @IsString()
  baseDescription?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.composition !== null)
  @IsString()
  composition?: string | null;
}

