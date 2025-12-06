import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiProperty({
    description: 'Ticket title',
    example: 'Product quality issue',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Ticket text/description',
    example: 'Customer reported quality issues with the product.',
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}







