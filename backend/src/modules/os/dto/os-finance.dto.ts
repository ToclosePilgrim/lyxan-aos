export class OsFinancialDocumentDto {
  id: string;
  type?: string | null;
  docType?: string | null;
  docId?: string | null;
  date?: string | null;
  totalAmount?: number | null;
  currency?: string | null;
}

export class OsAccountingEntryDto {
  id: string;
  postingDate: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  currency: string;
  metadata?: any;
}

