import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class AnalyticsDashboardDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsString()
  @IsNotEmpty()
  countryId: string;

  @IsString()
  @IsNotEmpty()
  brandId: string;

  @IsOptional()
  @IsString()
  marketplaceId?: string;
}
