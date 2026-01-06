import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateBomItemDto } from './create-bom-item.dto';

export class UpsertBomDto {
  @ApiProperty({
    description: 'Array of BOM items',
    type: [CreateBomItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBomItemDto)
  items: CreateBomItemDto[];
}




