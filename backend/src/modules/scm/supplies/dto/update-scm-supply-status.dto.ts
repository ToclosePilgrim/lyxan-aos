import {
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ScmSupplyStatus } from '@prisma/client';

export class UpdateScmSupplyStatusDto {
  @ApiProperty({
    description: 'New supply status',
    enum: ScmSupplyStatus,
  })
  @IsEnum(ScmSupplyStatus)
  @IsNotEmpty()
  status: ScmSupplyStatus;
}

