import {
  IsArray,
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmSupplyReceiveItemDto {
  @ApiProperty({
    description: 'Supply item ID',
    example: 'item1',
  })
  @IsString()
  itemId: string;

  @ApiProperty({
    description: 'Quantity to receive (not cumulative)',
    example: 10,
  })
  @IsNumber()
  @Min(0)
  quantityToReceive: number;
}

export class ConfirmSupplyReceiveDto {
  @ApiProperty({
    description: 'Items to receive',
    type: [ConfirmSupplyReceiveItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmSupplyReceiveItemDto)
  items: ConfirmSupplyReceiveItemDto[];

  @ApiProperty({
    description: 'Received date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @ApiProperty({
    description: 'Comment',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;
}




