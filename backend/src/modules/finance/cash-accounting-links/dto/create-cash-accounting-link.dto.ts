import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { CashAccountingLinkRole } from '@prisma/client';

export class CreateCashAccountingLinkDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  moneyTransactionId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accountingEntryId: string;

  @ApiProperty({ enum: CashAccountingLinkRole })
  @IsEnum(CashAccountingLinkRole)
  role: CashAccountingLinkRole;
}




