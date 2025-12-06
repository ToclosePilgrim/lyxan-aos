import { IsString, IsNotEmpty } from 'class-validator';

export class AddCountryToBrandDto {
  @IsString()
  @IsNotEmpty()
  countryId: string;
}





