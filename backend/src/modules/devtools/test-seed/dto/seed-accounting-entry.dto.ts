import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SeedAccountingEntryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  legalEntityId: string;

  @ApiProperty({ description: 'Seed group id; becomes AccountingEntry.docId' })
  @IsString()
  @IsNotEmpty()
  seedId: string;

  @ApiProperty({
    description: 'Required idempotency key; becomes metadata.docLineId',
    example: 'opening:LE_ID',
  })
  @IsString()
  @IsNotEmpty()
  docLineId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  debitAccount: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  creditAccount: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'RUB' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({
    example: 1000,
    description:
      'Expected base amount after conversion; must match system conversion',
  })
  @IsNumber()
  amountBase: number;

  @ApiProperty({ required: false, description: 'ISO date; defaults to now' })
  @IsOptional()
  @IsString()
  postingDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  brandId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  countryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  marketplaceId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  warehouseId?: string | null;
}

