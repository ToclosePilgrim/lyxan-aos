export const FINANCE_BASE_CURRENCY = process.env.FINANCE_BASE_CURRENCY || 'USD';

/**
 * Interpret rateToBase as: 1 <currency> = rateToBase * <base currency>
 * Example (base USD): currency="EUR", rateToBase=1.10 => 1 EUR = 1.10 USD.
 */
export function getBaseCurrency(): string {
  return FINANCE_BASE_CURRENCY;
}




