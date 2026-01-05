export type AccountingEntry = {
  id: string;
  docType:
    | 'SUPPLY_RECEIPT'
    | 'PRODUCTION_COMPLETION'
    | 'FINANCIAL_DOCUMENT'
    | 'PAYMENT'
    | 'STOCK_TRANSFER'
    | 'STOCK_ADJUSTMENT'
    | 'OTHER';
  docId: string;
  lineNumber: number;
  postingDate: string;
  debitAccount: string;
  creditAccount: string;
  amount: string;
  currency: string;
  amountBase: string;
  description?: string | null;
};



















