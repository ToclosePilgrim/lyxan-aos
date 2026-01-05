import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ConsumeOneDto {
  @ApiProperty({ description: 'Quantity to consume', example: 10.5 })
  @IsNumber()
  @Min(0.0000001)
  @Type(() => Number)
  quantity: number;

  @ApiProperty({
    description: 'Optional note for the consumption operation',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}

