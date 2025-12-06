import { IsArray, IsString } from 'class-validator';

export class UpdateMarketplaceCountriesDto {
  @IsArray()
  @IsString({ each: true })
  countryIds: string[];
}





