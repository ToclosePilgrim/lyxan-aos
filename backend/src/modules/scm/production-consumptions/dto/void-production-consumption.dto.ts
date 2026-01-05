import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoidProductionConsumptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}

