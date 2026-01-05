import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoidAcquiringEventDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}

