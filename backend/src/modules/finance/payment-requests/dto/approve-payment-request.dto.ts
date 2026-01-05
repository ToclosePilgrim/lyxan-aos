import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApprovePaymentRequestDto {
  @ApiProperty({
    description: 'Who approved (free-form for MVP)',
    example: 'cfo@company',
  })
  @IsString()
  @IsNotEmpty()
  approvedBy: string;

  @ApiProperty({
    required: false,
    description: 'Approver role for policy matching (e.g. CFO/CEO)',
  })
  @IsOptional()
  @IsString()
  approverRole?: string;
}
