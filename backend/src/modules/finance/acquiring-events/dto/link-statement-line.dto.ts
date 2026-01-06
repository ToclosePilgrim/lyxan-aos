import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LinkStatementLineDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  statementLineId: string;
}




