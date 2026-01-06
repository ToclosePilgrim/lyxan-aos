import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDefaultMappingDto } from './create-category-default-mapping.dto';

export class UpdateCategoryDefaultMappingDto extends PartialType(
  CreateCategoryDefaultMappingDto,
) {}




