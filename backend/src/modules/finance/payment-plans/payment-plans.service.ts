import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentPlanStatus,
  PaymentRequestStatus,
  Prisma,
} from '@prisma/client';
import crypto from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import { CurrencyRateService } from '../currency-rates/currency-rate.service';

@Injectable()
export class PaymentPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyRates: CurrencyRateService,
  ) {}

  async create(input: {
    paymentRequestId: string;
    fromAccountId?: string;
    plannedDate: Date;
    plannedAmount: Prisma.Decimal | string | number;
  }) {
    const pr = await this.prisma.paymentRequest.findUnique({
      where: { id: input.paymentRequestId },
      select: {
        id: true,
        status: true,
        legalEntityId: true,
        amount: true,
        currency: true,
      },
    });
    if (!pr) throw new NotFoundException('PaymentRequest not found');
    if (
      pr.status !== PaymentRequestStatus.APPROVED &&
      pr.status !== (PaymentRequestStatus as any).PARTIALLY_PAID
    ) {
      throw new ConflictException(
        'PaymentRequest must be APPROVED (or PARTIALLY_PAID) to create a plan',
      );
    }

    const plannedAmount = new Prisma.Decimal(input.plannedAmount);
    if (plannedAmount.lte(0))
      throw new BadRequestException('plannedAmount must be > 0');
    const plannedDate = new Date(input.plannedDate);
    if (Number.isNaN(plannedDate.getTime())) {
      throw new BadRequestException('plannedDate is invalid');
    }

    if (input.fromAccountId) {
      const acc = await this.prisma.financialAccount.findUnique({
        where: { id: input.fromAccountId },
        select: { id: true, legalEntityId: true, currency: true },
      });
      if (!acc) throw new NotFoundException('fromAccount not found');
      if (acc.legalEntityId !== pr.legalEntityId) {
        throw new BadRequestException(
          'fromAccount must belong to the same legalEntity',
        );
      }
      if (acc.currency.toUpperCase() !== pr.currency.toUpperCase()) {
        throw new BadRequestException(
          'fromAccount currency must match payment request currency',
        );
      }
    }

    // Validate coverage: sum(PLANNED) + new <= request.amount
    const agg = await this.prisma.paymentPlan.aggregate({
      where: {
        paymentRequestId: pr.id,
        status: PaymentPlanStatus.PLANNED,
      },
      _sum: { plannedAmount: true },
    });
    const already = agg._sum.plannedAmount ?? new Prisma.Decimal(0);
    const totalAfter = new Prisma.Decimal(already).add(plannedAmount);
    const reqAmount = new Prisma.Decimal(pr.amount as any);
    if (totalAfter.gt(reqAmount)) {
      throw new BadRequestException(
        'Planned amount exceeds payment request amount',
      );
    }

    const plannedAmountBase = await this.currencyRates.convertToBase({
      amount: plannedAmount,
      currency: pr.currency,
      date: plannedDate,
    });

    return this.prisma.paymentPlan.create({
      data: {
        id: crypto.randomUUID(),
        paymentRequestId: pr.id,
        legalEntityId: pr.legalEntityId,
        fromAccountId: input.fromAccountId ?? null,
        plannedDate,
        plannedAmount,
        currency: pr.currency,
        plannedAmountBase,
        status: PaymentPlanStatus.PLANNED,
      },
    });
  }

  async move(input: {
    planId: string;
    newPlannedDate: Date;
    newFromAccountId?: string;
  }) {
    const plan = await this.prisma.paymentPlan.findUnique({
      where: { id: input.planId },
      include: {
        paymentRequest: {
          select: {
            id: true,
            currency: true,
            legalEntityId: true,
            amount: true,
          },
        },
      },
    });
    if (!plan) throw new NotFoundException('PaymentPlan not found');
    if (plan.status !== PaymentPlanStatus.PLANNED) {
      throw new ConflictException('Only PLANNED plan can be moved');
    }

    const newDate = new Date(input.newPlannedDate);
    if (Number.isNaN(newDate.getTime()))
      throw new BadRequestException('newPlannedDate is invalid');

    if (input.newFromAccountId) {
      const acc = await this.prisma.financialAccount.findUnique({
        where: { id: input.newFromAccountId },
        select: { id: true, legalEntityId: true, currency: true },
      });
      if (!acc) throw new NotFoundException('newFromAccount not found');
      if (acc.legalEntityId !== plan.legalEntityId) {
        throw new BadRequestException(
          'fromAccount must belong to the same legalEntity',
        );
      }
      if (acc.currency.toUpperCase() !== plan.currency.toUpperCase()) {
        throw new BadRequestException(
          'fromAccount currency must match plan currency',
        );
      }
    }

    // Create new row and mark old MOVED (audit)
    return this.prisma.$transaction(async (tx) => {
      await tx.paymentPlan.update({
        where: { id: plan.id },
        data: {
          status: PaymentPlanStatus.MOVED,
          note: `moved_to:${newDate.toISOString()}`,
        },
      });

      const plannedAmountBase = await this.currencyRates.convertToBase({
        amount: plan.plannedAmount,
        currency: plan.currency,
        date: newDate,
      });

      const newPlan = await tx.paymentPlan.create({
        data: {
          id: crypto.randomUUID(),
          paymentRequestId: plan.paymentRequestId,
          legalEntityId: plan.legalEntityId,
          fromAccountId: input.newFromAccountId ?? plan.fromAccountId ?? null,
          plannedDate: newDate,
          plannedAmount: plan.plannedAmount,
          currency: plan.currency,
          plannedAmountBase,
          status: PaymentPlanStatus.PLANNED,
          movedFromPlanId: plan.id,
          note: `moved_from:${plan.id}`,
        },
      });

      return { moved: plan.id, created: newPlan.id, newPlan };
    });
  }

  async cancel(planId: string) {
    const plan = await this.prisma.paymentPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('PaymentPlan not found');
    if (plan.status !== PaymentPlanStatus.PLANNED) {
      throw new ConflictException('Only PLANNED plan can be canceled');
    }
    return this.prisma.paymentPlan.update({
      where: { id: planId },
      data: { status: PaymentPlanStatus.CANCELED },
    });
  }
}
