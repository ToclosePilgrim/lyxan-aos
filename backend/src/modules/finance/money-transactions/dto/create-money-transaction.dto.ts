import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import {
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
} from '@prisma/client';

export class CreateMoneyTransactionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ description: 'ISO date-time string' })
  @IsDateString()
  occurredAt: string;

  @ApiProperty({ enum: MoneyTransactionDirection })
  @IsEnum(MoneyTransactionDirection)
  direction: MoneyTransactionDirection;

  @ApiProperty({ description: 'Decimal amount (positive)', example: '1000' })
  @Transform(({ value }) => (value !== undefined ? String(value) : value))
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty({
    description: 'Currency, must match account.currency',
    example: 'RUB',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    required: false,
    description: 'Supplier id (optional counterparty)',
  })
  @IsOptional()
  @IsString()
  counterpartyId?: string;

  @ApiProperty({
    description: 'Cashflow category id (required for manual money tx)',
  })
  @IsString()
  @IsNotEmpty()
  cashflowCategoryId: string;

  @ApiProperty({ enum: MoneyTransactionSourceType })
  @IsEnum(MoneyTransactionSourceType)
  sourceType: MoneyTransactionSourceType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sourceId?: string;

  @ApiProperty({ description: 'Idempotency key (required)', example: 'k1' })
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}
