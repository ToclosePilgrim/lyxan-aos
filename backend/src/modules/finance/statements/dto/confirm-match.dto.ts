import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class ConfirmMatchDto {
  @ApiProperty({ description: 'Matched entity type (e.g. MONEY_TRANSACTION)' })
  @IsIn(['PAYMENT_EXECUTION', 'MONEY_TRANSACTION'])
  @IsString()
  entityType!: 'PAYMENT_EXECUTION' | 'MONEY_TRANSACTION';

  @ApiProperty({ description: 'Matched entity id' })
  @IsString()
  entityId!: string;
}
