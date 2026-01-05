import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  IsNotEmpty,
} from 'class-validator';
import { FinancialAccountStatus, FinancialAccountType } from '@prisma/client';

export class CreateFinancialAccountDto {
  @ApiProperty({ description: 'Legal entity ID' })
  @IsString()
  @IsNotEmpty()
  legalEntityId: string;

  @ApiProperty({ enum: FinancialAccountType })
  @IsEnum(FinancialAccountType)
  type: FinancialAccountType;

  @ApiProperty({
    description: 'ISO 4217 currency code (e.g. RUB)',
    example: 'RUB',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsString()
  @Length(3, 3)
  currency: string;

  @ApiProperty({ description: 'Human readable name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    required: false,
    description: 'Provider (Sber/Alfa/Tinkoff/Stripe/Ozon/...)',
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty({
    required: false,
    description: 'External reference (account number / merchantId / walletId)',
  })
  @IsOptional()
  @IsString()
  externalRef?: string;

  @ApiProperty({
    required: false,
    enum: FinancialAccountStatus,
    default: FinancialAccountStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(FinancialAccountStatus)
  status?: FinancialAccountStatus;
}

