import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  FinancialDocumentType,
  FinancialDocumentStatus,
  FinancialDocumentDirection,
} from '@prisma/client';

export class FinancialDocumentFiltersDto {
  @ApiProperty({
    description: 'Filter by document type',
    enum: FinancialDocumentType,
    required: false,
  })
  @IsOptional()
  @IsEnum(FinancialDocumentType)
  type?: FinancialDocumentType;

  @ApiProperty({
    description: 'Filter by document direction',
    enum: FinancialDocumentDirection,
    required: false,
  })
  @IsOptional()
  @IsEnum(FinancialDocumentDirection)
  direction?: FinancialDocumentDirection;

  @ApiProperty({
    description: 'Filter by document status',
    enum: FinancialDocumentStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(FinancialDocumentStatus)
  status?: FinancialDocumentStatus;

  @ApiProperty({
    description: 'Filter by supplier ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({
    description: 'Filter by production order ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @ApiProperty({
    description: 'Filter by SCM supply ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  scmSupplyId?: string;

  @ApiProperty({
    description: 'Filter by document date from',
    required: false,
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({
    description: 'Filter by document date to',
    required: false,
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiProperty({
    description: 'Offset for pagination',
    required: false,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiProperty({
    description: 'Limit for pagination (will be clamped to 100)',
    required: false,
    default: 20,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({
    description: 'Search by document number or external ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}

