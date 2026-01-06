import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class GetBalanceSheetDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  legalEntityId: string;

  @ApiProperty({
    description: 'As-of date (YYYY-MM-DD or ISO)',
    example: '2025-12-31',
  })
  @IsDateString()
  at: string;

  @ApiProperty({
    required: false,
    description: 'Include zero-balance accounts',
    default: false,
  })
  @IsOptional()
  @IsString()
  includeZero?: string;
}




