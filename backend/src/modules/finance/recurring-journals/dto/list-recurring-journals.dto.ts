import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RecurringJournalStatus, RecurringJournalType } from '@prisma/client';

export class ListRecurringJournalsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  legalEntityId?: string;

  @ApiProperty({ required: false, enum: RecurringJournalStatus })
  @IsOptional()
  @IsEnum(RecurringJournalStatus)
  status?: RecurringJournalStatus;

  @ApiProperty({ required: false, enum: RecurringJournalType })
  @IsOptional()
  @IsEnum(RecurringJournalType)
  journalType?: RecurringJournalType;
}




