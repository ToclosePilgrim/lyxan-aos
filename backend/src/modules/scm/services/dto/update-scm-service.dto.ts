import { PartialType } from '@nestjs/swagger';
import { CreateScmServiceDto } from './create-scm-service.dto';

export class UpdateScmServiceDto extends PartialType(CreateScmServiceDto) {}




