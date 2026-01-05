import { PartialType } from '@nestjs/swagger';
import { CreateOverheadRuleDto } from './create-overhead-rule.dto';

export class UpdateOverheadRuleDto extends PartialType(CreateOverheadRuleDto) {}

