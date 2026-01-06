import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { CounterpartyRole } from '@prisma/client';

export class CreateCounterpartyDto {
  @ApiProperty({
    description: 'Counterparty name',
    example: 'ACME Supplies LLC',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Unique code (optional). If omitted, will be generated.',
    required: false,
    example: 'ACME',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    description: 'Roles',
    isArray: true,
    enum: CounterpartyRole,
    example: [CounterpartyRole.SUPPLIER],
  })
  @IsArray()
  @IsEnum(CounterpartyRole, { each: true })
  roles: CounterpartyRole[];
}




