import { PartialType } from '@nestjs/swagger';
import { CreateSupplierItemDto } from './create-supplier-item.dto';

export class UpdateSupplierItemDto extends PartialType(CreateSupplierItemDto) {}




