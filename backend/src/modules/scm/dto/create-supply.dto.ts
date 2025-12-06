import {
  IsArray,
  ValidateNested,
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SupplyItemDto {
  @IsString()
  @IsNotEmpty()
  skuId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateSupplyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SupplyItemDto)
  items: SupplyItemDto[];
}







