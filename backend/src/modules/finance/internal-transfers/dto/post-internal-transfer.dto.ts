import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PostInternalTransferDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  outMoneyTransactionId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  inMoneyTransactionId: string;
}




