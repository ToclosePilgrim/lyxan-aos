import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsISO8601,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  FinancialDocumentType,
  FinancialDocumentStatus,
  FinancialDocumentDirection,
} from '@prisma/client';

export class CreateFinancialDocumentDto {
  @ApiProperty({
    description: 'Document number',
    required: false,
    example: 'INV-2025-0001',
  })
  @IsOptional()
  @IsString()
  docNumber?: string;

  @ApiProperty({
    description: 'Document date',
    required: false,
    example: '2025-01-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  docDate?: string;

  @ApiProperty({
    description: 'Document type',
    enum: FinancialDocumentType,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(FinancialDocumentType)
  type?: FinancialDocumentType;

  @ApiProperty({
    description: 'Document direction',
    enum: FinancialDocumentDirection,
    required: false,
  })
  @IsOptional()
  @IsEnum(FinancialDocumentDirection)
  direction?: FinancialDocumentDirection;

  @ApiProperty({
    description: 'Document status',
    enum: FinancialDocumentStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(FinancialDocumentStatus)
  status?: FinancialDocumentStatus;

  @ApiProperty({
    description: 'Currency code',
    required: false,
    example: 'RUB',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    description: 'Total amount',
    required: false,
    example: 50000,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  amountTotal?: number;

  @ApiProperty({
    description: 'Amount paid',
    required: false,
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  amountPaid?: number;

  @ApiProperty({
    description: 'Due date',
    required: false,
    example: '2025-02-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @ApiProperty({
    description: 'Supplier ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({
    description: 'Production Order ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @ApiProperty({
    description: 'SCM Supply ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  scmSupplyId?: string;

  @ApiProperty({
    description: 'Purchase ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  purchaseId?: string;

  @ApiProperty({
    description: 'Expense ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  expenseId?: string;

  @ApiProperty({
    description: 'External ID (from external system)',
    required: false,
  })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiProperty({
    description: 'File URL',
    required: false,
  })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiProperty({
    description: 'Notes',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
