import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePaymentPlanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  paymentRequestId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fromAccountId?: string;

  @ApiProperty({ description: 'Planned date (ISO)' })
  @IsDateString()
  plannedDate: string;

  @ApiProperty({ description: 'Decimal amount', example: '60' })
  @Transform(({ value }) => (value !== undefined ? String(value) : value))
  @IsString()
  @IsNotEmpty()
  plannedAmount: string;
}

