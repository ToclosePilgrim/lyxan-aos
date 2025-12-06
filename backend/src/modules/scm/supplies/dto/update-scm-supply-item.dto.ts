import { PartialType } from '@nestjs/swagger';
import { CreateScmSupplyItemDto } from './create-scm-supply-item.dto';

export class UpdateScmSupplyItemDto extends PartialType(
  CreateScmSupplyItemDto,
) {}
