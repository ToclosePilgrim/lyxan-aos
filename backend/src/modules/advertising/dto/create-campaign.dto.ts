import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCampaignDto {
  @ApiProperty({
    description: 'Marketplace ID',
    example: 'marketplace-id',
  })
  @IsString()
  @IsNotEmpty()
  marketplaceId: string;

  @ApiProperty({
    description: 'Campaign name',
    example: 'Summer Sale Campaign',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Campaign status',
    example: 'ACTIVE',
    enum: ['ACTIVE', 'PAUSED', 'STOPPED'],
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'STOPPED'])
  status?: string;

  @ApiProperty({
    description: 'Campaign budget',
    example: 100000,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  budget?: number;
}







