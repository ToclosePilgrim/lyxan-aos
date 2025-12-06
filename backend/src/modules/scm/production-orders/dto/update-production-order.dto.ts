import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProductionOrderStatus } from '@prisma/client';

export class UpdateProductionOrderDto {
  @ApiProperty({
    description: 'Order name',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Order status',
    enum: ProductionOrderStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ProductionOrderStatus)
  status?: ProductionOrderStatus;

  @ApiProperty({
    description: 'Planned start date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  plannedStartAt?: string;

  @ApiProperty({
    description: 'Planned end date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  plannedEndAt?: string;

  @ApiProperty({
    description: 'Actual start date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  actualStartAt?: string;

  @ApiProperty({
    description: 'Actual end date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  actualEndAt?: string;

  @ApiProperty({
    description: 'Production site description',
    required: false,
  })
  @IsOptional()
  @IsString()
  productionSite?: string;

  @ApiProperty({
    description: 'Notes/comments',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Production country ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  productionCountryId?: string;

  @ApiProperty({
    description: 'Manufacturer (supplier) ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  manufacturerId?: string;
}

