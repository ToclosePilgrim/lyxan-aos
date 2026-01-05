import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaymentRequestStatus } from '@prisma/client';

export class ListPaymentRequestsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  legalEntityId?: string;

  @ApiProperty({ required: false, enum: PaymentRequestStatus })
  @IsOptional()
  @IsEnum(PaymentRequestStatus)
  status?: PaymentRequestStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  to?: string;
}
