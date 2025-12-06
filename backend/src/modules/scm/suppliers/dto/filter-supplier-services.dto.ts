import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class FilterSupplierServicesDto {
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




