import { AccountingDocType, Prisma } from '@prisma/client';
import {
  assertDoubleEntryInvariants,
  computeDocumentBalance,
} from './accounting-validation.service';

describe('computeDocumentBalance', () => {
  it('balanced document (totals match per currency)', () => {
    const res = computeDocumentBalance([
      {
        debitAccount: '62.01',
        creditAccount: '90.01',
        amountBase: new Prisma.Decimal('100.00'),
        currency: 'RUB',
      },
      {
        debitAccount: '90.02',
        creditAccount: '10.02',
        amountBase: new Prisma.Decimal('60.00'),
        currency: 'RUB',
      },
    ]);

    const rub = res.currencyTotals.find((t) => t.currency === 'RUB');
    expect(rub).toBeTruthy();
    expect(rub?.isBalanced).toBe(true);
  });

  it('unbalanced when one side is missing', () => {
    const res = computeDocumentBalance([
      {
        debitAccount: '62.01',
        creditAccount: '',
        amountBase: new Prisma.Decimal('100.00'),
        currency: 'RUB',
      },
    ]);
    const rub = res.currencyTotals.find((t) => t.currency === 'RUB');
    expect(rub?.isBalanced).toBe(false);
  });

  it('invalid (non double-entry) entry is rejected by invariant checker', () => {
    expect(() =>
      assertDoubleEntryInvariants({
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: 'doc-1',
        entries: [
          {
            debitAccount: '',
            creditAccount: '90.01',
            amountBase: new Prisma.Decimal('100.00'),
            currency: 'RUB',
          },
        ],
      }),
    ).toThrow();
  });
});
