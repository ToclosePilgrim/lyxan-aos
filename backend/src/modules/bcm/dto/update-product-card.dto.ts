import { IsString, IsOptional, IsArray } from 'class-validator';

export class UpdateProductCardDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  attributes?: any;

  @IsArray()
  @IsOptional()
  images?: string[];
}







