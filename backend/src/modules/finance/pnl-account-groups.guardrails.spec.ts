import { PNL_RELEVANT_ACCOUNTS } from './pnl-account-groups';
import { ACCOUNTING_ACCOUNTS } from './accounting-accounts.config';

describe('Finance P&L account groups guardrails', () => {
  it('inventory↔COGS clearing account must not be classified as P&L', () => {
    // FIN.1 guardrail: clearing accounts must not affect P&L totals.
    expect(PNL_RELEVANT_ACCOUNTS).not.toContain(
      ACCOUNTING_ACCOUNTS.CLEARING_INVENTORY_COGS,
    );
    // Also ensure we do not accidentally include the acquiring sales clearing either.
    expect(PNL_RELEVANT_ACCOUNTS).not.toContain(
      ACCOUNTING_ACCOUNTS.CLEARING_ACQUIRING_SALES,
    );
  });
});


