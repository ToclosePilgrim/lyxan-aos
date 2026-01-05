import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ScmSupplyStatus } from '@prisma/client';

export class CreateScmSupplyDto {
  @ApiProperty({
    description: 'Supplier Counterparty ID (MDM.Counterparty)',
    example: 'cp_123',
  })
  @IsString()
  @IsNotEmpty()
  supplierCounterpartyId: string;

  @ApiProperty({
    description: 'Warehouse ID',
    example: 'wh1',
  })
  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @ApiProperty({
    description:
      'Brand ID (optional, but required for inventory/accounting scope on receipts)',
    required: false,
  })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiProperty({
    description: 'Production Order ID (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  productionOrderId?: string;

  @ApiProperty({
    description: 'Supply status',
    enum: ScmSupplyStatus,
    required: false,
    default: ScmSupplyStatus.DRAFT,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(ScmSupplyStatus)
  status?: ScmSupplyStatus;

  @ApiProperty({
    description: 'Currency code',
    example: 'RUB',
  })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({
    description: 'Order date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @ApiProperty({
    description: 'Expected delivery date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiProperty({
    description: 'Comment',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
