import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMarketplaceDto {
  @ApiProperty({ example: 'OZON' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Ozon' })
  @IsString()
  @IsNotEmpty()
  name: string;
}




