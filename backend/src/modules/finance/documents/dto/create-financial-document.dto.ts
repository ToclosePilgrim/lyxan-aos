import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsISO8601,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  FinancialDocumentType,
  FinancialDocumentStatus,
  FinancialDocumentDirection,
  FinanceLinkedDocType,
  FinanceCapitalizationPolicy,
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

  // Backward-compatible alias (some flows still send `date`)
  @ApiProperty({
    description: 'Alias for docDate',
    required: false,
    example: '2025-01-15T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiProperty({
    description: 'Document type',
    enum: FinancialDocumentType,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
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
    description:
      'Legal entity ID (if not provided, will be resolved from linked doc)',
    required: false,
  })
  @IsOptional()
  @IsString()
  legalEntityId?: string;

  @ApiProperty({
    description: 'P&L category ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  pnlCategoryId?: string;

  @ApiProperty({
    description: 'Cashflow category ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  cashflowCategoryId?: string;

  @ApiProperty({
    description: 'Capitalization policy',
    enum: FinanceCapitalizationPolicy,
    required: false,
    default: FinanceCapitalizationPolicy.EXPENSE_IMMEDIATE,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(FinanceCapitalizationPolicy)
  capitalizationPolicy?: FinanceCapitalizationPolicy;

  @ApiProperty({
    description: 'Recognition period start (required for PREPAID_EXPENSE)',
    required: false,
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  recognizedFrom?: string;

  @ApiProperty({
    description: 'Recognition period end (required for PREPAID_EXPENSE)',
    required: false,
    example: '2025-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601()
  recognizedTo?: string;

  @ApiProperty({
    description:
      'Useful life in months (required for FIXED_ASSET / INTANGIBLE)',
    required: false,
    example: 36,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  usefulLifeMonths?: number;

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
    description: 'Linked document type',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(FinanceLinkedDocType)
  linkedDocType?: FinanceLinkedDocType;

  @ApiProperty({
    description: 'Linked document ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  linkedDocId?: string;

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

  @ApiProperty({
    description: 'Mark document as auto-created by system',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isAutoCreated?: boolean;
}
