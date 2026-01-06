import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AcquiringEventType } from '@prisma/client';

export class AcquiringEventInputDto {
  @ApiProperty({ enum: AcquiringEventType })
  @IsEnum(AcquiringEventType)
  eventType: AcquiringEventType;

  @ApiProperty({ example: '2025-12-23T12:00:00.000Z' })
  @IsDateString()
  occurredAt: string;

  @ApiProperty({ example: '1000.00', description: 'Decimal amount' })
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty({ example: 'RUB' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({
    example: 'txn_123',
    description: 'External reference in acquiring provider',
  })
  @IsString()
  @IsNotEmpty()
  externalRef: string;

  @ApiProperty({
    required: false,
    description: 'Order id in our system (optional)',
  })
  @IsOptional()
  @IsString()
  orderId?: string;
}

export class ImportAcquiringEventsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  legalEntityId: string;

  @ApiProperty({ example: 'TINKOFF' })
  @IsString()
  @IsNotEmpty()
  provider: string;

  @ApiProperty({ type: [AcquiringEventInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcquiringEventInputDto)
  events: AcquiringEventInputDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  raw?: any;
}




