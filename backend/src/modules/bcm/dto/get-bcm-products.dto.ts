import { IsNotEmpty, IsUUID } from 'class-validator';

export class GetBcmProductsDto {
  @IsUUID()
  @IsNotEmpty()
  countryId: string;

  @IsUUID()
  @IsNotEmpty()
  brandId: string;
}




