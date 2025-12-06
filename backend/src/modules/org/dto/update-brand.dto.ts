import { IsString, IsOptional, IsArray, Length } from 'class-validator';

export class UpdateBrandDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Length(2, 50)
  code?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  countryIds?: string[];
}



