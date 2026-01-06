import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExplainBalanceSheetAccountDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  legalEntityId: string;

  @ApiProperty({ description: 'As-of date (YYYY-MM-DD or ISO)' })
  @IsDateString()
  at: string;

  @ApiProperty({ description: 'Account code, e.g. 51.00' })
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ required: false, description: 'From date (ISO)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}




