import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePnlCategoryDto {
  @ApiProperty({ example: 'PNL_OPEX' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'OPEX' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

