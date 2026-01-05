import { ApiProperty } from '@nestjs/swagger';
import { ScmProductType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateScmProductDto {
  @ApiProperty({ description: 'Internal name', example: 'Vimty Retinol 30ml' })
  @IsString()
  @IsNotEmpty()
  internalName: string;

  @ApiProperty({ description: 'SKU (optional)', required: false })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({ description: 'Brand ID (optional)', required: false })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiProperty({
    description:
      'Produced MDM item ID (optional). If set, links ScmProduct -> MdmItem.',
    required: false,
  })
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiProperty({ description: 'Product type (optional)', required: false })
  @IsOptional()
  @IsEnum(ScmProductType)
  type?: ScmProductType;

  @ApiProperty({ description: 'Base description (optional)', required: false })
  @IsOptional()
  @IsString()
  baseDescription?: string;

  @ApiProperty({ description: 'Composition (optional)', required: false })
  @IsOptional()
  @IsString()
  composition?: string;
}
