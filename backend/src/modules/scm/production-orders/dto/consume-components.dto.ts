import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ValidateNested,
  IsString,
  IsNumber,
  Min,
  ArrayMinSize,
} from 'class-validator';

export class ConsumeComponentItemDto {
  @ApiProperty({ description: 'Production order item ID', example: 'poi_123' })
  @IsString()
  productionOrderItemId: string;

  @ApiProperty({ description: 'Quantity to consume', example: 10 })
  @IsNumber()
  @Min(0.0000001)
  quantity: number;
}

export class ConsumeComponentsDto {
  @ApiProperty({ type: [ConsumeComponentItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConsumeComponentItemDto)
  items: ConsumeComponentItemDto[];
}




