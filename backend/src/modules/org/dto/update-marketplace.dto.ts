import { IsString, IsOptional, Length } from 'class-validator';

export class UpdateMarketplaceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @Length(2, 50)
  code?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;
}



