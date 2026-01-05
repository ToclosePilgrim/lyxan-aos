import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RepostProductionCompletionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}

