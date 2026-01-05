import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsInt,
  Max,
  Min,
} from 'class-validator';
import { AccountingDocType } from '@prisma/client';

export class ListAccountingEntriesDto {
  @ApiPropertyOptional({ enum: AccountingDocType })
  @IsOptional()
  @IsEnum(AccountingDocType)
  docType?: AccountingDocType;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsISO8601()
  toDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  debitAccount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  creditAccount?: string;

  @ApiPropertyOptional({
    description: 'Limit results (max 1000)',
    default: 500,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

