import { PartialType } from '@nestjs/mapped-types';
import { CreateSupplierServiceDto } from './create-supplier-service.dto';

export class UpdateSupplierServiceDto extends PartialType(CreateSupplierServiceDto) {}




