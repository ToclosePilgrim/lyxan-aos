import { UnprocessableEntityException } from '@nestjs/common';

function formatYyyyMmDd(date: Date): string {
  // Keep it simple and dependency-free. Used only for user-facing error messages.
  return date.toISOString().slice(0, 10);
}

export class CurrencyRateNotFoundError extends UnprocessableEntityException {
  constructor(currency: string, date: Date) {
    super({
      message: `Нет курса для валюты ${currency} на дату ${formatYyyyMmDd(date)} или ранее. Добавьте курс и повторите.`,
      code: 'CURRENCY_RATE_NOT_FOUND',
      details: {
        currency,
        date: formatYyyyMmDd(date),
      },
    });
  }
}
