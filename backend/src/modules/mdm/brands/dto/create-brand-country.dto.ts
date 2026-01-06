import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBrandCountryDto {
  @ApiProperty({ description: 'Brand ID' })
  @IsString()
  @IsNotEmpty()
  brandId: string;

  @ApiProperty({ description: 'Country ID' })
  @IsString()
  @IsNotEmpty()
  countryId: string;

  @ApiProperty({ description: 'LegalEntity ID', required: false })
  @IsOptional()
  @IsString()
  legalEntityId?: string;
}




