import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { AccountingDocType } from '@prisma/client';

export class ListAccountingEntriesByDocDto {
  @ApiProperty({ enum: AccountingDocType })
  @IsEnum(AccountingDocType)
  docType: AccountingDocType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  docId: string;
}




