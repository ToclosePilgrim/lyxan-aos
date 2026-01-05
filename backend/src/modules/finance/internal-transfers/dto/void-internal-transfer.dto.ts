import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoidInternalTransferDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}

