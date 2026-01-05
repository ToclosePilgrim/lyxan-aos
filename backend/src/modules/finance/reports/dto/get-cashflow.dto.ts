import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class GetCashflowDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  legalEntityId: string;

  @ApiProperty({ example: '2025-01-01' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2025-01-31' })
  @IsDateString()
  to: string;

  @ApiProperty({ required: false, default: 'BASE' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({
    required: false,
    default: 'category',
    enum: ['category', 'topLevelCategory'],
  })
  @IsOptional()
  @IsIn(['category', 'topLevelCategory'])
  groupBy?: 'category' | 'topLevelCategory';

  @ApiProperty({
    required: false,
    default: 'true',
    description: 'Include transfers in byCategory breakdown',
  })
  @IsOptional()
  @IsString()
  includeTransfers?: string;
}

