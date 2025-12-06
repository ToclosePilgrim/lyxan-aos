import { PartialType } from '@nestjs/swagger';
import { CreateFinancialDocumentDto } from './create-financial-document.dto';

export class UpdateFinancialDocumentDto extends PartialType(
  CreateFinancialDocumentDto,
) {}
