import { PartialType } from '@nestjs/swagger';
import { CreateScmSupplyDto } from './create-scm-supply.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ScmSupplyStatus } from '@prisma/client';

export class UpdateScmSupplyDto extends PartialType(CreateScmSupplyDto) {
  @ApiProperty({
    description: 'Supply status',
    enum: ScmSupplyStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ScmSupplyStatus)
  status?: ScmSupplyStatus;
}
