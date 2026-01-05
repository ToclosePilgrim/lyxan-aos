import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class ListStatementsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  legalEntityId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
