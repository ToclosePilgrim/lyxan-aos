import { IsString, IsNotEmpty, Length } from 'class-validator';

export class CreateCountryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 10)
  code: string;
}







