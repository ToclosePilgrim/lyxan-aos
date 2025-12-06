import { IsString, IsNotEmpty, IsArray, Length } from 'class-validator';

export class CreateBrandDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  code: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  countryIds: string[];
}



