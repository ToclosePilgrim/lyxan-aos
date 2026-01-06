import { ApiProperty } from '@nestjs/swagger';
import {
  RecurringJournalFrequency,
  RecurringJournalStatus,
  RecurringJournalType,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateRecurringJournalDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  legalEntityId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sourceDocumentId?: string;

  @ApiProperty({ enum: RecurringJournalType })
  @IsEnum(RecurringJournalType)
  journalType: RecurringJournalType;

  @ApiProperty({
    required: false,
    enum: RecurringJournalStatus,
    default: RecurringJournalStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(RecurringJournalStatus)
  status?: RecurringJournalStatus;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    required: false,
    enum: RecurringJournalFrequency,
    default: RecurringJournalFrequency.MONTHLY,
  })
  @IsOptional()
  @IsEnum(RecurringJournalFrequency)
  frequency?: RecurringJournalFrequency;

  @ApiProperty({ required: false, default: 1, minimum: 1, maximum: 28 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  dayOfMonth?: number;

  @ApiProperty({
    description: 'Amount (document currency)',
    example: '1000.00',
  })
  @Transform(({ value }) => (value !== undefined ? String(value) : value))
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty({ description: 'Currency (3-letter)', example: 'RUB' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiProperty({ description: 'Amount in base currency', example: '1000.00' })
  @Transform(({ value }) => (value !== undefined ? String(value) : value))
  @IsString()
  @IsNotEmpty()
  amountBase: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  debitAccountId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  creditAccountId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pnlCategoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cashflowCategoryId?: string;
}




