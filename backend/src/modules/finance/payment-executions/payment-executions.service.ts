import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingDocType,
  CashAccountingLinkRole,
  FinanceCapitalizationPolicy,
  MoneyTransactionDirection,
  MoneyTransactionSourceType,
  MoneyTransactionStatus,
  PaymentExecutionStatus,
  PaymentPlanStatus,
  PaymentRequestStatus,
  Prisma,
  StatementLineStatus,
} from '@prisma/client';
import crypto from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import { MoneyTransactionsService } from '../money-transactions/money-transactions.service';
import { AccountingEntryService } from '../accounting-entry/accounting-entry.service';
import { CashAccountingLinksService } from '../cash-accounting-links/cash-accounting-links.service';
import { ACCOUNTING_ACCOUNTS } from '../accounting-accounts.config';
import { financeConfig } from '../../../config/finance.config';
import { FinancialDocumentsService } from '../documents/financial-documents.service';
import { PostingRunsService } from '../posting-runs/posting-runs.service';

@Injectable()
export class PaymentExecutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moneyTx: MoneyTransactionsService,
    private readonly accounting: AccountingEntryService,
    private readonly cashLinks: CashAccountingLinksService,
    private readonly financialDocs: FinancialDocumentsService,
    private readonly postingRuns: PostingRunsService,
  ) {}

  private accrualDebitAccount(policy: FinanceCapitalizationPolicy): string {
    switch (policy) {
      case FinanceCapitalizationPolicy.EXPENSE_IMMEDIATE:
        return ACCOUNTING_ACCOUNTS.RENT_EXPENSE;
      case FinanceCapitalizationPolicy.PREPAID_EXPENSE:
        return ACCOUNTING_ACCOUNTS.PREPAID_EXPENSE_ASSET;
      case FinanceCapitalizationPolicy.FIXED_ASSET:
        return ACCOUNTING_ACCOUNTS.FIXED_ASSET;
      case FinanceCapitalizationPolicy.INTANGIBLE:
        return ACCOUNTING_ACCOUNTS.INTANGIBLE_ASSET;
      case FinanceCapitalizationPolicy.INVENTORY:
        return ACCOUNTING_ACCOUNTS.INVENTORY_MATERIALS;
      default:
        return ACCOUNTING_ACCOUNTS.RENT_EXPENSE;
    }
  }

  async executePlan(params: {
    paymentPlanId: string;
    fromAccountId?: string;
    executedAt?: Date;
    bankReference?: string;
    description?: string;
  }) {
    const plan = await this.prisma.paymentPlan.findUnique({
      where: { id: params.paymentPlanId },
      include: {
        paymentRequest: {
          select: {
            id: true,
            legalEntityId: true,
            amount: true,
            currency: true,
            status: true,
            financialDocumentId: true,
            cashflowCategoryId: true,
          },
        },
      },
    });
    if (!plan) throw new NotFoundException('PaymentPlan not found');
    // Idempotency: if already executed (or otherwise non-PLANNED), return existing execution if present.
    const preExisting = await this.prisma.paymentExecution.findUnique({
      where: { paymentPlanId: plan.id },
    });
    if (preExisting) {
      return { paymentExecution: preExisting, alreadyExisted: true };
    }
    if (plan.status !== PaymentPlanStatus.PLANNED) {
      throw new ConflictException('Only PLANNED plan can be executed');
    }

    const pr = plan.paymentRequest as any;
    if (
      pr.status !== PaymentRequestStatus.APPROVED &&
      pr.status !== (PaymentRequestStatus as any).PARTIALLY_PAID
    ) {
      throw new ConflictException(
        'PaymentRequest must be APPROVED to execute a plan',
      );
    }

    const fromAccountId = params.fromAccountId ?? plan.fromAccountId ?? null;
    if (!fromAccountId) {
      throw new BadRequestException(
        'fromAccountId is required (plan.fromAccountId or body)',
      );
    }

    const executedAt = params.executedAt
      ? new Date(params.executedAt)
      : new Date();

    return this.prisma.$transaction(async (tx) => {
      // Idempotency: 1 execution per plan
      const existing = await tx.paymentExecution.findUnique({
        where: { paymentPlanId: plan.id },
      });
      if (existing) {
        return { paymentExecution: existing, alreadyExisted: true };
      }

      // Validate account
      const fromAcc = await tx.financialAccount.findUnique({
        where: { id: fromAccountId },
        select: { id: true, legalEntityId: true, currency: true },
      });
      if (!fromAcc) throw new NotFoundException('fromAccount not found');
      if (fromAcc.legalEntityId !== plan.legalEntityId) {
        throw new BadRequestException(
          'fromAccount must belong to the same legalEntity',
        );
      }
      if (fromAcc.currency.toUpperCase() !== plan.currency.toUpperCase()) {
        throw new BadRequestException(
          'fromAccount currency must match plan currency',
        );
      }

      // Optional AP accrual fallback (one-time) for financialDocument
      if (pr.financialDocumentId) {
        const doc = await tx.financialDocument.findUnique({
          where: { id: pr.financialDocumentId },
          select: {
            id: true,
            legalEntityId: true,
            currency: true,
            amountTotal: true,
            capitalizationPolicy: true,
            isAccrued: true,
            supplierId: true,
          },
        });
        if (!doc) throw new NotFoundException('FinancialDocument not found');
        if (doc.legalEntityId !== plan.legalEntityId) {
          throw new BadRequestException(
            'FinancialDocument legalEntityId mismatch',
          );
        }
        if (!doc.isAccrued) {
          // Strict mode by default: payment cannot proceed without document accrual.
          const canFallback =
            financeConfig.enablePaymentAccrualFallback &&
            (doc.capitalizationPolicy as any) ===
              FinanceCapitalizationPolicy.EXPENSE_IMMEDIATE;

          if (!canFallback) {
            throw new ConflictException(
              'Document must be accrued before payment',
            );
          }

          await this.financialDocs.accrueDocument({
            id: doc.id,
            tx,
            postingDate: executedAt,
          });
        }
      }

      // Create PaymentExecution
      const amount = new Prisma.Decimal(plan.plannedAmount as any);
      const amountBase = new Prisma.Decimal(plan.plannedAmountBase as any);
      const paymentExecution = await tx.paymentExecution.create({
        data: {
          id: crypto.randomUUID(),
          paymentPlanId: plan.id,
          legalEntityId: plan.legalEntityId,
          fromAccountId: fromAcc.id,
          executedAt,
          amount,
          currency: plan.currency,
          amountBase,
          bankReference: params.bankReference ?? null,
          description: params.description ?? null,
          status: PaymentExecutionStatus.EXECUTED,
        },
      });

      // Create MoneyTransaction OUT (idempotent via idempotency key)
      const moneyTransaction = await this.moneyTx.create({
        tx,
        accountId: fromAcc.id,
        occurredAt: executedAt,
        direction: MoneyTransactionDirection.OUT,
        amount,
        currency: plan.currency,
        description:
          params.description ?? `Payment execution ${paymentExecution.id}`,
        cashflowCategoryId: pr.cashflowCategoryId ?? undefined,
        sourceType: MoneyTransactionSourceType.PAYMENT_EXECUTION,
        sourceId: paymentExecution.id,
        idempotencyKey: `payment_execution:${paymentExecution.id}:out`,
      });

      // AccountingEntry: Dr AP / Cr CASH_EQUIVALENTS (MVP rule: always closes AP)
      const run = await this.postingRuns.getOrCreatePostedRun({
        tx,
        legalEntityId: plan.legalEntityId,
        docType: AccountingDocType.PAYMENT_EXECUTION,
        docId: paymentExecution.id,
      });

      const existingEntries = await tx.accountingEntry.findMany({
        where: { postingRunId: run.id } as any,
        orderBy: [{ lineNumber: 'asc' }],
      });

      const paymentEntry =
        existingEntries[0] ??
        (await this.accounting.createEntry({
          tx,
          docType: AccountingDocType.PAYMENT_EXECUTION,
          docId: paymentExecution.id,
          legalEntityId: plan.legalEntityId,
          lineNumber: 1,
          postingDate: executedAt,
          debitAccount: ACCOUNTING_ACCOUNTS.ACCOUNTS_PAYABLE_SUPPLIERS,
          creditAccount: ACCOUNTING_ACCOUNTS.CASH_EQUIVALENTS,
          amount,
          currency: plan.currency,
          description: `Payment execution ${paymentExecution.id}`,
          metadata: {
            docLineId: `payment_execution:${paymentExecution.id}:principal`,
            paymentExecutionId: paymentExecution.id,
            paymentPlanId: plan.id,
            paymentRequestId: plan.paymentRequestId,
            financialDocumentId: pr.financialDocumentId ?? null,
            fromAccountId: fromAcc.id,
          },
          postingRunId: run.id,
        }));

      await this.cashLinks.link({
        tx,
        moneyTransactionId: moneyTransaction.id,
        accountingEntryId: paymentEntry.id,
        role: CashAccountingLinkRole.PAYMENT_PRINCIPAL,
      });

      // Update plan status
      await tx.paymentPlan.update({
        where: { id: plan.id },
        data: { status: PaymentPlanStatus.EXECUTED, fromAccountId: fromAcc.id },
      });

      // Update request status (PARTIALLY_PAID/PAID)
      const sumExec = await tx.paymentExecution.aggregate({
        where: {
          paymentPlan: { paymentRequestId: plan.paymentRequestId },
        } as any,
        _sum: { amount: true },
      });
      const paid = sumExec._sum.amount ?? new Prisma.Decimal(0);
      const reqAmount = new Prisma.Decimal(pr.amount);
      const nextStatus = paid.gte(reqAmount)
        ? (PaymentRequestStatus as any).PAID
        : (PaymentRequestStatus as any).PARTIALLY_PAID;

      await tx.paymentRequest.update({
        where: { id: plan.paymentRequestId },
        data: { status: nextStatus },
      });

      return {
        paymentExecution,
        moneyTransaction,
        accountingEntry: paymentEntry,
      };
    });
  }

  async voidExecution(params: { id: string; reason: string }) {
    const reason = (params.reason ?? '').trim() || 'void';

    const exec = await this.prisma.paymentExecution.findUnique({
      where: { id: params.id },
      include: {
        paymentPlan: {
          select: {
            id: true,
            status: true,
            paymentRequestId: true,
            plannedAmount: true,
            currency: true,
          },
        },
      } as any,
    });
    if (!exec) throw new NotFoundException('PaymentExecution not found');

    const moneyTx = await this.prisma.moneyTransaction.findFirst({
      where: {
        sourceType: MoneyTransactionSourceType.PAYMENT_EXECUTION,
        sourceId: exec.id,
      } as any,
      select: { id: true, status: true },
    });
    if (!moneyTx)
      throw new NotFoundException('MoneyTransaction not found for execution');

    const reconciled = await (this.prisma as any).statementLine.findFirst({
      where: {
        postedMoneyTransactionId: moneyTx.id,
        status: StatementLineStatus.POSTED,
      } as any,
      select: { id: true },
    });
    if (reconciled) {
      throw new ConflictException(
        'reconciled cash cannot be voided; create adjustment instead',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const existingVoidedRun = await tx.accountingPostingRun.findFirst({
        where: {
          legalEntityId: exec.legalEntityId,
          docType: AccountingDocType.PAYMENT_EXECUTION,
          docId: exec.id,
          status: 'VOIDED',
          reversalRunId: { not: null },
        } as any,
        orderBy: [{ version: 'desc' }],
        select: { id: true, reversalRunId: true },
      });

      // Void the cash movement itself (real money), but keep it idempotent.
      await tx.moneyTransaction.update({
        where: { id: moneyTx.id },
        data: {
          status: MoneyTransactionStatus.VOIDED,
          voidedAt: new Date(),
          voidReason: reason,
        } as any,
      });

      await tx.paymentExecution.update({
        where: { id: exec.id },
        data: { status: PaymentExecutionStatus.CANCELED } as any,
      });

      // Mark the plan as CANCELED (since its execution was voided)
      if (exec.paymentPlanId) {
        await tx.paymentPlan.update({
          where: { id: exec.paymentPlanId },
          data: { status: PaymentPlanStatus.CANCELED } as any,
        });
      }

      // Recalculate request status: sum of non-canceled executions for all plans of the request
      const plan = await tx.paymentPlan.findUnique({
        where: { id: exec.paymentPlanId },
        select: { paymentRequestId: true },
      });
      const reqId = plan?.paymentRequestId ?? null;
      if (reqId) {
        const req = await tx.paymentRequest.findUnique({
          where: { id: reqId },
          select: { id: true, amount: true },
        });
        if (req) {
          const sumExec = await tx.paymentExecution.aggregate({
            where: {
              paymentPlan: { paymentRequestId: req.id },
              status: { not: PaymentExecutionStatus.CANCELED } as any,
            } as any,
            _sum: { amount: true },
          });
          const paid = sumExec._sum.amount ?? new Prisma.Decimal(0);
          const reqAmount = new Prisma.Decimal(req.amount as any);
          const nextStatus = paid.gte(reqAmount)
            ? PaymentRequestStatus.PAID
            : paid.gt(0)
              ? PaymentRequestStatus.PARTIALLY_PAID
              : PaymentRequestStatus.APPROVED;
          await tx.paymentRequest.update({
            where: { id: req.id },
            data: { status: nextStatus } as any,
          });
        }
      }

      if (existingVoidedRun?.reversalRunId) {
        return {
          alreadyVoided: true,
          paymentExecutionId: exec.id,
          moneyTransactionId: moneyTx.id,
          originalRunId: existingVoidedRun.id,
          reversalRunId: existingVoidedRun.reversalRunId,
        };
      }

      const run = await this.postingRuns.getActivePostedRun({
        tx,
        legalEntityId: exec.legalEntityId,
        docType: AccountingDocType.PAYMENT_EXECUTION,
        docId: exec.id,
      });
      if (!run) {
        // Edge-case: no ledger run found; still report voided cash + statuses updated.
        return {
          voided: true,
          paymentExecutionId: exec.id,
          moneyTransactionId: moneyTx.id,
          originalRunId: null,
          reversalRunId: null,
        };
      }

      const res = await this.postingRuns.voidRun({ tx, runId: run.id, reason });

      return {
        voided: true,
        paymentExecutionId: exec.id,
        moneyTransactionId: moneyTx.id,
        originalRunId: run.id,
        reversalRunId: (res as any).reversalRun?.id ?? null,
      };
    });
  }

  async list(params: { legalEntityId?: string; from?: Date; to?: Date }) {
    const where: Prisma.PaymentExecutionWhereInput = {};
    if (params.legalEntityId)
      (where as any).legalEntityId = params.legalEntityId;
    if (params.from || params.to) {
      (where as any).executedAt = {};
      if (params.from) (where as any).executedAt.gte = params.from;
      if (params.to) (where as any).executedAt.lte = params.to;
    }
    return this.prisma.paymentExecution.findMany({
      where,
      orderBy: [{ executedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async repostExecution(params: { id: string; reason: string }) {
    const reason = (params.reason ?? '').trim() || 'repost';
    const exec = await this.prisma.paymentExecution.findUnique({
      where: { id: params.id },
      include: {
        paymentPlan: true,
        legalEntity: { select: { id: true } },
      } as any,
    });
    if (!exec) throw new NotFoundException('PaymentExecution not found');

    // Void existing execution first (will enforce reconciliation guard)
    await this.voidExecution({ id: exec.id, reason });

    const planCreation = await this.prisma.$transaction(async (tx) => {
      const oldPlan = await tx.paymentPlan.findUnique({
        where: { id: exec.paymentPlanId },
      });
      if (!oldPlan) throw new NotFoundException('PaymentPlan not found');

      // Idempotency: if a moved plan already exists and has an execution, return it.
      const existingMovedPlan = await tx.paymentPlan.findFirst({
        where: { movedFromPlanId: oldPlan.id } as any,
        orderBy: [{ createdAt: 'desc' }],
        include: { PaymentExecution: true },
      });
      if (existingMovedPlan?.PaymentExecution) {
        return {
          alreadyReposted: true,
          oldPaymentExecutionId: exec.id,
          newPaymentPlanId: existingMovedPlan.id,
          newPaymentExecutionId: existingMovedPlan.PaymentExecution.id,
        };
      }

      // Mark old plan as MOVED (it was executed and then voided; now replaced)
      await tx.paymentPlan.update({
        where: { id: oldPlan.id },
        data: { status: PaymentPlanStatus.MOVED } as any,
      });

      const newPlan = await tx.paymentPlan.create({
        data: {
          id: crypto.randomUUID(),
          paymentRequestId: oldPlan.paymentRequestId,
          legalEntityId: oldPlan.legalEntityId,
          fromAccountId: oldPlan.fromAccountId,
          plannedDate: new Date(),
          plannedAmount: oldPlan.plannedAmount,
          plannedAmountBase: oldPlan.plannedAmountBase,
          currency: oldPlan.currency,
          status: PaymentPlanStatus.PLANNED,
          note: `repost of execution ${exec.id}`,
          movedFromPlanId: oldPlan.id,
        } as any,
      });

      return {
        alreadyReposted: false,
        oldPaymentExecutionId: exec.id,
        newPaymentPlanId: newPlan.id,
        newPaymentExecutionId: null,
      };
    });

    if (planCreation.alreadyReposted) {
      return planCreation;
    }

    // Execute after tx commit (so the plan is visible to executePlan which uses its own transaction)
    const res = await this.executePlan({
      paymentPlanId: planCreation.newPaymentPlanId,
      executedAt: new Date(),
      description: `Repost of ${exec.id}`,
    });

    return {
      ...planCreation,
      newPaymentExecutionId: (res as any)?.paymentExecution?.id ?? null,
    };
  }
}
