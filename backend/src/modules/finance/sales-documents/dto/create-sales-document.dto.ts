import { ApiProperty } from '@nestjs/swagger';
import { SalesDocumentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class CreateSalesDocumentLineDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiProperty({ description: 'ISO date' })
  @IsString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ example: '1' })
  @IsString()
  @IsNotEmpty()
  quantity: string;

  @ApiProperty({ example: '0' })
  @IsString()
  @IsNotEmpty()
  revenue: string;

  @ApiProperty({ example: '100' })
  @IsString()
  @IsNotEmpty()
  commission: string;

  @ApiProperty({ required: false, example: '0' })
  @IsOptional()
  @IsString()
  refunds?: string;

  @ApiProperty({ required: false, example: '0' })
  @IsOptional()
  @IsString()
  cogsAmount?: string;

  @ApiProperty({
    required: false,
    description: 'Arbitrary metadata (marketplace keys used for feeKey)',
  })
  @IsOptional()
  meta?: any;
}

export class CreateSalesDocumentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  countryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  marketplaceId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiProperty({ example: 'E2E' })
  @IsString()
  @IsNotEmpty()
  sourceType: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiProperty({ description: 'ISO date' })
  @IsString()
  @IsNotEmpty()
  periodFrom: string;

  @ApiProperty({ description: 'ISO date' })
  @IsString()
  @IsNotEmpty()
  periodTo: string;

  @ApiProperty({
    required: false,
    enum: SalesDocumentStatus,
    default: SalesDocumentStatus.IMPORTED,
  })
  @IsOptional()
  @IsEnum(SalesDocumentStatus)
  status?: SalesDocumentStatus;

  @ApiProperty({ type: [CreateSalesDocumentLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesDocumentLineDto)
  lines: CreateSalesDocumentLineDto[];
}




