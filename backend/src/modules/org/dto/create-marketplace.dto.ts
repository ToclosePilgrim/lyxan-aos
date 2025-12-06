import { IsString, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class CreateMarketplaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  code: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;
}



