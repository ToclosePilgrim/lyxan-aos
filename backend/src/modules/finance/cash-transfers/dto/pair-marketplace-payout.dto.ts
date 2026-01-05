import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PairMarketplacePayoutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  walletStatementLineId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bankStatementLineId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  externalRef?: string;
}
