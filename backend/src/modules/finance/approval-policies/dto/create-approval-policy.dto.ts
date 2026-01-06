import { ApiProperty } from '@nestjs/swagger';
import { PaymentRequestType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateApprovalPolicyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  legalEntityId: string;

  @ApiProperty({ enum: PaymentRequestType })
  @IsEnum(PaymentRequestType)
  type: PaymentRequestType;

  @ApiProperty({ example: '0' })
  @IsString()
  @IsNotEmpty()
  amountBaseFrom: string;

  @ApiProperty({ required: false, example: null })
  @IsOptional()
  @IsString()
  amountBaseTo?: string | null;

  @ApiProperty({ example: 'CFO' })
  @IsString()
  @IsNotEmpty()
  approverRole: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isAutoApprove?: boolean;
}




