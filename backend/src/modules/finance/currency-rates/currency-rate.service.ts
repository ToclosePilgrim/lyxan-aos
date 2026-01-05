import { Injectable } from '@nestjs/common';
import { Prisma, CurrencyRate } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { FINANCE_BASE_CURRENCY } from '../constants';
import { CurrencyRateNotFoundError } from './errors';

function startOfDayUtc(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class CurrencyRateService {
  constructor(private readonly prisma: PrismaService) {}

  async getBaseCurrency(): Promise<string> {
    return FINANCE_BASE_CURRENCY;
  }

  async upsertRate(input: {
    currency: string;
    rateDate: Date;
    rateToBase: number;
    source?: string;
  }) {
    const dateOnly = startOfDayUtc(input.rateDate);
    const currency = input.currency.toUpperCase();
    return this.prisma.currencyRate.upsert({
      where: {
        currency_rateDate: { currency, rateDate: dateOnly },
      },
      update: {
        rateToBase: input.rateToBase,
        source: input.source ?? 'manual',
      },
      create: {
        currency,
        rateDate: dateOnly,
        rateToBase: input.rateToBase,
        source: input.source ?? 'manual',
      },
    });
  }

  async getRateForDate(params: { currency: string; date: Date }) {
    const dateOnly = startOfDayUtc(params.date);
    return this.prisma.currencyRate.findUnique({
      where: {
        currency_rateDate: { currency: params.currency.toUpperCase(), rateDate: dateOnly },
      },
    });
  }

  async getEffectiveRate(params: {
    currency: string;
    date: Date;
  }): Promise<CurrencyRate | null> {
    const baseCurrency = FINANCE_BASE_CURRENCY;
    const dateOnly = startOfDayUtc(params.date);
    if (params.currency.toUpperCase() === baseCurrency.toUpperCase()) {
      const now = new Date();
      return {
        id: 'synthetic_base',
        currency: baseCurrency,
        rateDate: dateOnly,
        rateToBase: new Prisma.Decimal(1),
        source: 'synthetic_base',
        createdAt: now,
        updatedAt: now,
      };
    }

    return this.prisma.currencyRate.findFirst({
      where: {
        currency: params.currency.toUpperCase(),
        rateDate: { lte: dateOnly },
      },
      orderBy: { rateDate: 'desc' },
    });
  }

  async convertToBase(params: {
    amount: Prisma.Decimal | number | string;
    currency: string;
    date: Date;
  }) {
    const baseCurrency = FINANCE_BASE_CURRENCY;
    if (params.currency?.toUpperCase() === baseCurrency.toUpperCase()) {
      return new Prisma.Decimal(params.amount);
    }
    const rate = await this.getEffectiveRate({
      currency: params.currency,
      date: params.date,
    });
    if (!rate) {
      throw new CurrencyRateNotFoundError(params.currency, params.date);
    }
    return new Prisma.Decimal(params.amount).mul(rate.rateToBase);
  }

  async listRates(filter?: {
    currency?: string;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const where: any = {};
    if (filter?.currency) {
      where.currency = filter.currency.toUpperCase();
    }
    if (filter?.fromDate || filter?.toDate) {
      where.rateDate = {};
      if (filter.fromDate) {
        where.rateDate.gte = startOfDayUtc(filter.fromDate);
      }
      if (filter.toDate) {
        where.rateDate.lte = startOfDayUtc(filter.toDate);
      }
    }

    return this.prisma.currencyRate.findMany({
      where,
      orderBy: { rateDate: 'desc' },
      take: 1000,
    });
  }

  async getById(id: string) {
    return this.prisma.currencyRate.findUnique({ where: { id } });
  }
}
