import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IntegrationStatus } from '@prisma/client';

export class UpdateMarketplaceIntegrationDto {
  @ApiProperty({
    description: 'Integration name',
    example: 'Ozon – Vimty – Russia',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Integration status',
    enum: IntegrationStatus,
    example: 'ACTIVE',
    required: false,
  })
  @IsOptional()
  @IsEnum(IntegrationStatus)
  status?: IntegrationStatus;

  @ApiProperty({
    description: 'Ozon Seller API Client ID',
    example: '123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  ozonSellerClientId?: string;

  @ApiProperty({
    description: 'Ozon Seller API Token',
    example: 'token-here',
    required: false,
  })
  @IsOptional()
  @IsString()
  ozonSellerToken?: string | null;

  @ApiProperty({
    description: 'Ozon Performance API Client ID',
    example: '789012',
    required: false,
  })
  @IsOptional()
  @IsString()
  ozonPerfClientId?: string;

  @ApiProperty({
    description: 'Ozon Performance API Client Secret',
    example: 'secret-here',
    required: false,
  })
  @IsOptional()
  @IsString()
  ozonPerfClientSecret?: string | null;
}





