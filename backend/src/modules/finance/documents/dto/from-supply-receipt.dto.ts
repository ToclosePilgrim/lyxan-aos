import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class FromSupplyReceiptDto {
  @ApiProperty({ description: 'SCM SupplyReceipt ID' })
  @IsString()
  @IsNotEmpty()
  supplyReceiptId: string;

  @ApiProperty({ required: false, description: 'Invoice number' })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiProperty({ required: false, description: 'Invoice date (ISO)' })
  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @ApiProperty({
    required: false,
    description: 'Invoice amount (defaults to receipt total)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.0000001)
  amount?: number;

  @ApiProperty({
    required: false,
    description: 'Invoice currency (defaults to receipt currency)',
  })
  @IsOptional()
  @IsString()
  currency?: string;
}

