import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class ControlsQueueDto {
  @ApiProperty({
    enum: [
      'NEW',
      'SUGGESTED',
      'MATCHED',
      'ERROR',
      'UNEXPLAINED_CASH',
      'POSTED_MISSING_LINKS',
    ],
  })
  @IsString()
  @IsIn([
    'NEW',
    'SUGGESTED',
    'MATCHED',
    'ERROR',
    'UNEXPLAINED_CASH',
    'POSTED_MISSING_LINKS',
  ])
  type: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  legalEntityId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({ required: false, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
