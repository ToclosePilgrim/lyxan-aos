import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class EntityExplainDto {
  @ApiProperty({
    description:
      'Entity type, e.g. PaymentExecution, FinancialDocument, StatementLine, AcquiringEvent, MoneyTransaction',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;
}




