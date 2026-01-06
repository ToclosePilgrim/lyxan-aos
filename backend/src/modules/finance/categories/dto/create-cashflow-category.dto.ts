import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCashflowCategoryDto {
  @ApiProperty({ example: 'CF_OPS' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Operations' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isTransfer?: boolean;
}




