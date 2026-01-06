import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ListFinancialAccountsDto {
  @ApiProperty({ description: 'Legal entity ID', required: true })
  @IsString()
  @IsNotEmpty()
  legalEntityId: string;

  @ApiProperty({
    required: false,
    description: 'Include archived accounts',
    default: false,
  })
  @IsOptional()
  @IsString()
  includeArchived?: string;
}




