import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFinancePaymentDto {
  @ApiProperty({ description: 'Payment amount', example: 500 })
  @IsNumber()
  @Type(() => Number)
  amount: number;

  @ApiProperty({ description: 'Currency code (ISO)', example: 'USD' })
  @IsString()
  currency: string;

  @ApiProperty({
    description: 'Payment date',
    required: false,
    example: '2025-12-09',
  })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiProperty({
    description: 'Alias for payment date (paidAt)',
    required: false,
    example: '2025-12-09',
  })
  @IsOptional()
  @IsISO8601()
  paidAt?: string;

  @ApiProperty({
    description: 'Payment method',
    required: false,
    example: 'BANK_TRANSFER',
  })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiProperty({
    description: 'External reference',
    required: false,
    example: 'TRX-123456',
  })
  @IsOptional()
  @IsString()
  externalRef?: string;

  @ApiProperty({ description: 'Comment', required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}
