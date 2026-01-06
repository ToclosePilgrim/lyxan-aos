import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchAccrueFinancialDocumentsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  legalEntityId?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by createdAt from (ISO)',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, description: 'Filter by createdAt to (ISO)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({
    required: false,
    default: 50,
    description: 'Max docs to accrue',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}




