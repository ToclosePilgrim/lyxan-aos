import { IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { SupplierItemType } from '@prisma/client';

export class FilterSupplierItemsDto {
  @ApiProperty({
    description: 'Filter by item type',
    enum: SupplierItemType,
    required: false,
  })
  @IsOptional()
  @IsEnum(SupplierItemType)
  type?: SupplierItemType;

  @ApiProperty({
    description: 'Filter by active status',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === '1' || value === true) return true;
    if (value === 'false' || value === '0' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isActive?: boolean;
}

