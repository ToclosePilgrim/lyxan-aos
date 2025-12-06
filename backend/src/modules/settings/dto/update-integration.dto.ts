import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateIntegrationDto {
  @ApiProperty({
    description: 'Name of the integration',
    example: 'n8n Workflow Automation',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Configuration JSON object',
    example: { baseUrl: 'http://localhost:5678', authToken: 'token123' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}



