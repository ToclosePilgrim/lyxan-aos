import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { StatementLineStatus } from '@prisma/client';

export class ListStatementLinesDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  legalEntityId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiProperty({ required: false, enum: StatementLineStatus })
  @IsOptional()
  @IsEnum(StatementLineStatus)
  status?: StatementLineStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentLineId?: string;
}
