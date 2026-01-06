import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoidSalesDocumentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}




