import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateLegalEntityDto {
  @ApiProperty({ example: 'LE-001' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Acme LLC' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Country code (FK to Country.code)',
    example: 'RU',
  })
  @IsString()
  @IsNotEmpty()
  countryCode: string;
}

