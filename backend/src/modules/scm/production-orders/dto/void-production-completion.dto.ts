import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoidProductionCompletionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}

