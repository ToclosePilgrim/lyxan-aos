import { PartialType } from '@nestjs/swagger';
import { CreateScmSupplyDto } from './create-scm-supply.dto';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ScmSupplyStatus } from '@prisma/client';

export class UpdateScmSupplyDto extends PartialType(CreateScmSupplyDto) {
  // Status updates must go through transitionStatus endpoint; keep field for compatibility but ignore in service
  @ApiProperty({
    description: 'Supply status (ignored, use /transition endpoint)',
    enum: ScmSupplyStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ScmSupplyStatus)
  status?: ScmSupplyStatus;
}
