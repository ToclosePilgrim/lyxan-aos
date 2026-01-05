import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class BatchIgnoreDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  ids: string[];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}
