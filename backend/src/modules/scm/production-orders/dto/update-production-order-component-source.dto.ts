import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ComponentSourceTypeDto {
  OWN_STOCK = 'OWN_STOCK',
  PURCHASE_TO_OWN_WAREHOUSE = 'PURCHASE_TO_OWN_WAREHOUSE',
  PURCHASE_DIRECT_TO_MANUFACTURE = 'PURCHASE_DIRECT_TO_MANUFACTURE',
  TRANSFER_FROM_OWN_WAREHOUSE = 'TRANSFER_FROM_OWN_WAREHOUSE',
  THIRD_PARTY_WAREHOUSE = 'THIRD_PARTY_WAREHOUSE',
}

export class UpdateProductionOrderComponentSourceDto {
  @IsEnum(ComponentSourceTypeDto)
  sourceType: ComponentSourceTypeDto;

  @IsOptional()
  @IsString()
  sourceWarehouseId?: string;

  @IsOptional()
  @IsString()
  targetWarehouseId?: string;
}
