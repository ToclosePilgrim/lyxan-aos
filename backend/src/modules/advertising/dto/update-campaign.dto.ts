import { IsString, IsOptional, IsNumber, Min, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCampaignDto {
  @ApiProperty({
    description: 'Campaign name',
    example: 'Updated Campaign Name',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Campaign status',
    example: 'PAUSED',
    enum: ['ACTIVE', 'PAUSED', 'STOPPED'],
    required: false,
  })
  @IsString()
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'STOPPED'])
  status?: string;

  @ApiProperty({
    description: 'Campaign budget',
    example: 150000,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  budget?: number;
}

