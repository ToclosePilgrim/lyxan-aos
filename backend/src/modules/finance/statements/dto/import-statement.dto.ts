import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { StatementProvider, MoneyTransactionDirection } from '@prisma/client';

export class ImportStatementLineDto {
  @ApiProperty()
  @IsISO8601()
  occurredAt!: string;

  @ApiProperty({ enum: MoneyTransactionDirection })
  @IsEnum(MoneyTransactionDirection)
  direction!: MoneyTransactionDirection;

  @ApiProperty({ description: 'Amount in statement currency', example: '100.00' })
  @IsString()
  amount!: string;

  @ApiProperty({ example: 'RUB' })
  @IsString()
  currency!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankReference?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  externalLineId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  counterpartyName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  counterpartyInn?: string;
}

export class ImportStatementDto {
  @ApiProperty()
  @IsString()
  accountId!: string;

  @ApiProperty({ enum: StatementProvider })
  @IsEnum(StatementProvider)
  provider!: StatementProvider;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sourceName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  periodFrom?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  periodTo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  importHash?: string;

  @ApiProperty({ type: [ImportStatementLineDto] })
  @IsArray()
  @Type(() => ImportStatementLineDto)
  lines!: ImportStatementLineDto[];
}
