import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AttachServiceDto {
  @ApiProperty({
    description: 'Array of service operation IDs to attach',
    type: [String],
    example: ['svc1', 'svc2'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  serviceIds: string[];
}




