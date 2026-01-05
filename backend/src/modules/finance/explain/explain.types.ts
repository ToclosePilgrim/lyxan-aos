export type ExplainPayload = {
  scope: { legalEntityId: string };
  context: {
    kind: 'BS' | 'CF' | 'ENTITY';
    at?: string;
    from?: string;
    to?: string;
  };
  items: ExplainItem[];
  page?: { limit: number; offset: number; total?: number };
};

export type ExplainItemKind =
  | 'ACCOUNTING_ENTRY_LINE'
  | 'MONEY_TRANSACTION'
  | 'STATEMENT_LINE'
  | 'ACQUIRING_EVENT'
  | 'INVENTORY_MOVEMENT'
  | 'DOC';

export type ExplainLink = {
  type: 'CASH' | 'INVENTORY' | 'ACQUIRING';
  role: string;
  from: { type: string; id: string };
  to: { type: string; id: string };
};

export type PrimaryRef = {
  type:
    | 'FinancialDocument'
    | 'PaymentExecution'
    | 'PaymentRequest'
    | 'PaymentPlan'
    | 'Statement'
    | 'StatementLine'
    | 'MoneyTransaction'
    | 'CashTransfer'
    | 'ScmSupply'
    | 'ScmSupplyReceipt'
    | 'ProductionOrder'
    | 'SalesDocument'
    | 'AcquiringEvent'
    | 'StockMovement'
    | 'InventoryTransaction'
    | 'Other';
  id: string;
  display: { title: string; subtitle?: string };
};

export type ExplainItem = {
  kind: ExplainItemKind;
  id: string;
  occurredAt?: string;
  amountBase?: number;
  currency?: string;
  direction?: 'IN' | 'OUT';
  debitAccountId?: string;
  creditAccountId?: string;
  docType?: string;
  docId?: string;
  title: string;
  meta?: any;
  links: ExplainLink[];
  primary: PrimaryRef[];
};
