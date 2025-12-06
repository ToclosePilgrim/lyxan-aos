import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMarketplaceIntegrationDto {
  @ApiProperty({
    description: 'Marketplace ID',
    example: 'clx1234567890',
  })
  @IsString()
  @IsNotEmpty()
  marketplaceId: string;

  @ApiProperty({
    description: 'Brand ID',
    example: 'clx1234567890',
  })
  @IsString()
  @IsNotEmpty()
  brandId: string;

  @ApiProperty({
    description: 'Country ID (optional, will be taken from brand if not provided)',
    example: 'clx1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  countryId?: string;
}

