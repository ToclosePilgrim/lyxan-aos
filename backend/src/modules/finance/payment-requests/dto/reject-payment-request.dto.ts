import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectPaymentRequestDto {
  @ApiProperty({
    description: 'Who rejected (free-form for MVP)',
    example: 'cfo@company',
  })
  @IsString()
  @IsNotEmpty()
  rejectedBy: string;

  @ApiProperty({ description: 'Reject reason' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
