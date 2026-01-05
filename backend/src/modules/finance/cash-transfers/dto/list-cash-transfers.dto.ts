import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class ListCashTransfersDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  legalEntityId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiProperty({ required: false, enum: ['PAIRED', 'POSTED', 'CANCELED'] })
  @IsOptional()
  @IsString()
  @IsIn(['PAIRED', 'POSTED', 'CANCELED'])
  status?: 'PAIRED' | 'POSTED' | 'CANCELED';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  provider?: string;
}

