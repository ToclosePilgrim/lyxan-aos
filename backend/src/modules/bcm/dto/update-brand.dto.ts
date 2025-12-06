import { IsString, IsOptional, IsArray, MaxLength } from 'class-validator';

export class UpdateBrandDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  countryIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  toneOfVoice?: string;
}



