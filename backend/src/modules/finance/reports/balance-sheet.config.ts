import { ACCOUNTING_ACCOUNTS } from '../accounting-accounts.config';

export type BalanceSheetSectionId = 'assets' | 'liabilities' | 'equity';

export type BalanceSheetGroupConfig = {
  id: string;
  name: string;
  accounts: string[];
};

export const BALANCE_SHEET_CONFIG: {
  assets: BalanceSheetGroupConfig[];
  liabilities: BalanceSheetGroupConfig[];
  equity: BalanceSheetGroupConfig[];
  accountNames: Record<string, string>;
} = {
  assets: [
    {
      id: 'cash_and_equivalents',
      name: 'Cash & equivalents',
      accounts: [
        ACCOUNTING_ACCOUNTS.CASH_EQUIVALENTS,
        ACCOUNTING_ACCOUNTS.CASH_BANK,
        ACCOUNTING_ACCOUNTS.CASH_OTHER,
      ],
    },
    {
      id: 'clearing',
      name: 'Clearing accounts',
      accounts: [
        ACCOUNTING_ACCOUNTS.CASH_TRANSFER_CLEARING,
        ACCOUNTING_ACCOUNTS.CLEARING_ACQUIRING,
        ACCOUNTING_ACCOUNTS.CLEARING_ACQUIRING_SALES,
      ],
    },
    {
      id: 'accounts_receivable',
      name: 'Accounts receivable',
      accounts: [ACCOUNTING_ACCOUNTS.ACCOUNTS_RECEIVABLE_MARKETPLACE],
    },
    {
      id: 'inventory',
      name: 'Inventory',
      accounts: [
        ACCOUNTING_ACCOUNTS.INVENTORY_MATERIALS,
        ACCOUNTING_ACCOUNTS.INVENTORY_FINISHED_GOODS,
        ACCOUNTING_ACCOUNTS.WIP_PRODUCTION,
      ],
    },
    {
      id: 'prepaid_expenses',
      name: 'Prepaid expenses',
      accounts: [ACCOUNTING_ACCOUNTS.PREPAID_EXPENSE_ASSET],
    },
    {
      id: 'fixed_assets',
      name: 'Fixed assets (PPE)',
      accounts: [ACCOUNTING_ACCOUNTS.FIXED_ASSET],
    },
    {
      id: 'intangibles',
      name: 'Intangible assets',
      accounts: [ACCOUNTING_ACCOUNTS.INTANGIBLE_ASSET],
    },
  ],

  liabilities: [
    {
      id: 'accounts_payable',
      name: 'Accounts payable',
      accounts: [ACCOUNTING_ACCOUNTS.ACCOUNTS_PAYABLE_SUPPLIERS],
    },
    {
      id: 'taxes_payable',
      name: 'Taxes payable',
      accounts: [ACCOUNTING_ACCOUNTS.ACCOUNTS_PAYABLE_TAXES],
    },
  ],

  equity: [
    {
      id: 'contributed_capital',
      name: 'Contributed capital',
      accounts: ['80.01'],
    },
    {
      id: 'retained_earnings',
      name: 'Retained earnings',
      accounts: ['84.01'],
    },
    {
      id: 'current_period_profit',
      name: 'Current period profit',
      accounts: ['99.01'],
    },
  ],

  accountNames: {
    [ACCOUNTING_ACCOUNTS.CASH_EQUIVALENTS]: 'Cash equivalents',
    [ACCOUNTING_ACCOUNTS.CASH_BANK]: 'Bank cash',
    [ACCOUNTING_ACCOUNTS.CASH_OTHER]: 'Cash (other)',
    [ACCOUNTING_ACCOUNTS.CASH_TRANSFER_CLEARING]: 'Transfer clearing',
    [ACCOUNTING_ACCOUNTS.CLEARING_ACQUIRING]: 'Acquiring clearing',
    [ACCOUNTING_ACCOUNTS.CLEARING_ACQUIRING_SALES]: 'Acquiring sales bridge',
    [ACCOUNTING_ACCOUNTS.ACCOUNTS_RECEIVABLE_MARKETPLACE]: 'AR marketplace',
    [ACCOUNTING_ACCOUNTS.INVENTORY_MATERIALS]: 'Inventory materials',
    [ACCOUNTING_ACCOUNTS.INVENTORY_FINISHED_GOODS]: 'Inventory finished goods',
    [ACCOUNTING_ACCOUNTS.WIP_PRODUCTION]: 'Work in progress',
    [ACCOUNTING_ACCOUNTS.PREPAID_EXPENSE_ASSET]: 'Prepaid expenses',
    [ACCOUNTING_ACCOUNTS.FIXED_ASSET]: 'Fixed assets',
    [ACCOUNTING_ACCOUNTS.INTANGIBLE_ASSET]: 'Intangible assets',
    [ACCOUNTING_ACCOUNTS.ACCOUNTS_PAYABLE_SUPPLIERS]: 'AP suppliers',
    [ACCOUNTING_ACCOUNTS.ACCOUNTS_PAYABLE_TAXES]: 'Taxes payable',
    ['80.01']: 'Equity capital',
    ['84.01']: 'Retained earnings',
    ['99.01']: 'Current profit',
  },
};




