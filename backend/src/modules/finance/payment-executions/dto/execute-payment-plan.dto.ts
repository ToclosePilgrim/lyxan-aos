import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class ExecutePaymentPlanDto {
  @ApiProperty({
    required: false,
    description: 'Override fromAccountId if not set on plan',
  })
  @IsOptional()
  @IsString()
  fromAccountId?: string;

  @ApiProperty({
    required: false,
    description: 'Execution timestamp (ISO). Default: now',
  })
  @IsOptional()
  @IsDateString()
  executedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankReference?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}




