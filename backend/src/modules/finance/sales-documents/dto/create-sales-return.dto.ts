import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalesReturnLineDto {
  @IsString()
  saleLineId!: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  quantity!: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  refundAmountBase!: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;
}

export class CreateSalesReturnDto {
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSalesReturnLineDto)
  lines!: CreateSalesReturnLineDto[];
}


