import { PartialType } from '@nestjs/swagger';
import { CreateScmProductDto } from './create-scm-product.dto';

export class UpdateScmProductDto extends PartialType(CreateScmProductDto) {}
