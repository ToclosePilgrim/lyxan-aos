import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class SplitPartDto {
  @ApiProperty({ example: '10.00' })
  @IsString()
  amount!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankReference?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  counterpartyName?: string;
}

export class SplitStatementLineDto {
  @ApiProperty({ type: [SplitPartDto] })
  @IsArray()
  @Type(() => SplitPartDto)
  splits!: SplitPartDto[];

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  forceSuggested?: boolean;
}
