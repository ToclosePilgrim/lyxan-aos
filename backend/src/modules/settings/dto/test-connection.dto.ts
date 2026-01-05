import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for testing marketplace integration connection
 * Allows passing credentials in the request body for testing before saving
 */
export class TestConnectionDto {
  @ApiProperty({
    description:
      'Ozon Seller API Client ID (optional, uses saved value if not provided)',
    example: '123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  ozonSellerClientId?: string;

  @ApiProperty({
    description:
      'Ozon Seller API Token (optional, uses saved value if not provided)',
    example: 'token-here',
    required: false,
  })
  @IsOptional()
  @IsString()
  ozonSellerToken?: string;

  @ApiProperty({
    description:
      'Ozon Performance API Client ID (optional, uses saved value if not provided)',
    example: '789012',
    required: false,
  })
  @IsOptional()
  @IsString()
  ozonPerfClientId?: string;

  @ApiProperty({
    description:
      'Ozon Performance API Client Secret (optional, uses saved value if not provided)',
    example: 'secret-here',
    required: false,
  })
  @IsOptional()
  @IsString()
  ozonPerfClientSecret?: string;
}
