/**
 * Request scope for multi-tenant data isolation
 */
export interface RequestScope {
  userId: string;
  isSuperAdmin: boolean;
  legalEntityId: string | null;
  brandId?: string | null;
  countryId?: string | null;
}

/**
 * Models that have legalEntityId field and should be auto-scoped
 */
export const MODELS_WITH_LEGAL_ENTITY_ID = [
  'AccountingEntry',
  'AccountingPostingRun',
  'AcquiringEvent',
  'CounterpartyOffer',
  'FinancialDocument',
  'RecurringJournal',
  'FinanceApprovalPolicy',
  'FinanceCategoryDefaultMapping',
  'PaymentRequest',
  'FinancialAccount',
  'PaymentPlan',
  'PaymentExecution',
  'Statement',
  'StatementLine',
  'MoneyTransaction',
] as const;

/**
 * Read operations that should be scoped
 */
export const READ_OPERATIONS = [
  'findMany',
  'findFirst',
  'findUnique',
  'count',
  'aggregate',
  'groupBy',
] as const;

export type ReadOperation = (typeof READ_OPERATIONS)[number];


