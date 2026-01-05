import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ScmServiceCategory } from '@prisma/client';

export class FilterScmServicesDto {
  @ApiProperty({
    description: 'Filter by production order ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @ApiProperty({
    description: 'Filter by supply ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  supplyId?: string;

  @ApiProperty({
    description: 'Filter by supplier ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({
    description: 'Filter by category',
    enum: ScmServiceCategory,
    required: false,
  })
  @IsOptional()
  @IsEnum(ScmServiceCategory)
  category?: ScmServiceCategory;

  @ApiProperty({
    description: 'Filter by financial document ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  financialDocumentId?: string;
}

