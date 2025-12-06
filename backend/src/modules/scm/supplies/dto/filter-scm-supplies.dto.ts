import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FilterScmSuppliesDto {
  @ApiProperty({
    description: 'Filter by status (can be multiple, comma-separated)',
    required: false,
    example: 'DRAFT,ORDERED',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    description: 'Filter by supplier ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({
    description: 'Filter by warehouse ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiProperty({
    description: 'Filter by production order ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @ApiProperty({
    description: 'Limit number of results (will be clamped to 100)',
    required: false,
    example: 50,
    minimum: 1,
  })
  @IsOptional()
  @IsString()
  limit?: string;
}

