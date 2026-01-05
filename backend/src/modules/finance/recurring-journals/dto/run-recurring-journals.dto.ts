import { ApiProperty } from '@nestjs/swagger';
import { RecurringJournalType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RunRecurringJournalsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  legalEntityId: string;

  @ApiProperty()
  @IsDateString()
  from: string;

  @ApiProperty()
  @IsDateString()
  to: string;

  @ApiProperty({ required: false, enum: RecurringJournalType })
  @IsOptional()
  @IsEnum(RecurringJournalType)
  journalType?: RecurringJournalType;

  @ApiProperty({ required: false, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

