import { ApiProperty } from '@nestjs/swagger';
import { MdmItemType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EnsureMdmItemDto {
  @ApiProperty({ enum: MdmItemType })
  @IsEnum(MdmItemType)
  type: MdmItemType;

  @ApiProperty({
    required: false,
    description: 'Item code (optional; auto-generated if omitted)',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  unit?: string;
}




