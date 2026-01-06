import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ClassifyStatementLineDto {
  @ApiProperty({
    required: false,
    description:
      'Normalized marketplace operation type (e.g. FEE/PENALTY/SERVICE/...)',
  })
  @IsOptional()
  @IsString()
  operationTypeHint?: string;

  @ApiProperty({
    required: false,
    description: 'Marketplace external operation/service code',
  })
  @IsOptional()
  @IsString()
  externalOperationCode?: string;

  @ApiProperty({
    required: false,
    description: 'Marketplace order id (if applicable)',
  })
  @IsOptional()
  @IsString()
  marketplaceOrderId?: string;

  @ApiProperty({
    required: false,
    description: 'SalesDocument id to map this fee/operation to (optional)',
  })
  @IsOptional()
  @IsString()
  saleDocumentId?: string;

  @ApiProperty({
    required: false,
    description:
      'Cashflow category id for fee posting (required when creating fee entry)',
  })
  @IsOptional()
  @IsString()
  cashflowCategoryId?: string;

  @ApiProperty({
    required: false,
    description: 'Precomputed normalized fee key for matching (optional)',
  })
  @IsOptional()
  @IsString()
  feeKey?: string;
}




