import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateCountryDto {
  @ApiProperty({ example: 'RU' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 10)
  code: string;

  @ApiProperty({ example: 'Russia' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

