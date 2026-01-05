import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class AnalyticsInventorySnapshotDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @IsUUID()
  @IsNotEmpty()
  countryId: string;

  @IsUUID()
  @IsNotEmpty()
  brandId: string;
}

