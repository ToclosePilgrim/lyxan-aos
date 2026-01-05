import { PartialType } from '@nestjs/swagger';
import { CreateBomItemDto } from './create-bom-item.dto';

export class UpdateBomItemDto extends PartialType(CreateBomItemDto) {}

