import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min, IsBoolean, IsNumber, IsDecimal } from 'class-validator';
import { SupplierRole as PrismaSupplierRole } from '@prisma/client';
import { SupplierRole } from '@aos/shared';

export class LinkScmProductDto {
  @IsString()
  @IsNotEmpty()
  scmProductId: string;

  @IsEnum(SupplierRole)
  role: SupplierRole;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderQty?: number;

  @IsOptional()
  @IsString()
  purchaseCurrency?: string;

  @IsOptional()
  @IsNumber()
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

