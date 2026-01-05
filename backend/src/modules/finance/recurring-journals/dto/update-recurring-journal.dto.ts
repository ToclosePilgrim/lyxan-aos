import { PartialType } from '@nestjs/swagger';
import { CreateRecurringJournalDto } from './create-recurring-journal.dto';

export class UpdateRecurringJournalDto extends PartialType(
  CreateRecurringJournalDto,
) {}

