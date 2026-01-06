import { AccountingDocType, Prisma } from '@prisma/client';
import { AccountingValidationService } from './accounting-validation.service';

describe('TZ7: Accounting validation always ON in production', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should validate even if ACCOUNTING_VALIDATE_ON_POST=false in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ACCOUNTING_VALIDATE_ON_POST = 'false';

    const prisma: any = {
      accountingEntry: {
        findMany: jest.fn().mockResolvedValue([
          {
            debitAccount: '',
            creditAccount: '90.01',
            amountBase: new Prisma.Decimal('1.00'),
            currency: 'RUB',
          },
        ]), // invalid -> should throw even in prod with flag false
      },
    };
    const svc = new AccountingValidationService(prisma);

    await expect(
      svc.maybeValidateDocumentBalanceOnPost({
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: 'doc-1',
        tx: prisma as any,
      }),
    ).rejects.toBeTruthy();
  });

  it('can be disabled in non-production via ACCOUNTING_VALIDATE_ON_POST=false', async () => {
    process.env.NODE_ENV = 'test';
    process.env.ACCOUNTING_VALIDATE_ON_POST = 'false';

    const prisma: any = {
      accountingEntry: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const svc = new AccountingValidationService(prisma);

    await expect(
      svc.maybeValidateDocumentBalanceOnPost({
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: 'doc-1',
        tx: prisma as any,
      }),
    ).resolves.toBeUndefined();
    expect(prisma.accountingEntry.findMany).not.toHaveBeenCalled();
  });

  it('defaults to ON in non-production when unset', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.ACCOUNTING_VALIDATE_ON_POST;

    const prisma: any = {
      accountingEntry: {
        findMany: jest.fn().mockResolvedValue([
          {
            debitAccount: '62.01',
            creditAccount: '90.01',
            amountBase: new Prisma.Decimal('1.00'),
            currency: 'RUB',
          },
        ]),
      },
    };
    const svc = new AccountingValidationService(prisma);

    await expect(
      svc.maybeValidateDocumentBalanceOnPost({
        docType: AccountingDocType.SALES_DOCUMENT,
        docId: 'doc-1',
        tx: prisma as any,
      }),
    ).resolves.toBeUndefined();
    expect(prisma.accountingEntry.findMany).toHaveBeenCalled();
  });
});


