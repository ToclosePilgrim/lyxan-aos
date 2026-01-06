import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTicketStatusDto {
  @ApiProperty({
    description: 'Ticket status',
    example: 'IN_PROGRESS',
    enum: ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
  status: string;
}




