import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FinancialDocumentType, FinancialDocumentStatus } from '@prisma/client';

export class FilterFinancialDocumentsDto {
  @ApiProperty({
    description: 'Filter by supplier ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({
    description: 'Filter by status',
    enum: FinancialDocumentStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(FinancialDocumentStatus)
  status?: FinancialDocumentStatus;

  @ApiProperty({
    description: 'Filter by type',
    enum: FinancialDocumentType,
    required: false,
  })
  @IsOptional()
  @IsEnum(FinancialDocumentType)
  type?: FinancialDocumentType;

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
}




