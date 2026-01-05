import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { FinanceLinkedDocType, PaymentRequestType } from '@prisma/client';

export class CreatePaymentRequestDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  legalEntityId?: string;

  @ApiProperty({ enum: PaymentRequestType })
  @IsEnum(PaymentRequestType)
  type: PaymentRequestType;

  @ApiProperty({ description: 'Decimal amount', example: '1000' })
  @Transform(({ value }) => (value !== undefined ? String(value) : value))
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty({ example: 'RUB' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiProperty({ description: 'Planned pay date (ISO)' })
  @IsDateString()
  plannedPayDate: string;

  @ApiProperty({ required: false, description: 'Priority 0..3', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  counterpartyId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  financialDocumentId?: string;

  @ApiProperty({ required: false, enum: FinanceLinkedDocType })
  @IsOptional()
  @IsEnum(FinanceLinkedDocType)
  linkedDocType?: FinanceLinkedDocType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  linkedDocId?: string;

  @ApiProperty({ description: 'Cashflow category id' })
  @IsOptional()
  @IsString()
  cashflowCategoryId?: string;

  @ApiProperty({
    required: false,
    description:
      'Optional pnl category id (defaults from FinancialDocument if present)',
  })
  @IsOptional()
  @IsString()
  pnlCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, description: 'Attachments blob (JSON)' })
  @IsOptional()
  attachments?: any;
}
