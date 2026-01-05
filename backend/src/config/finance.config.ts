export const financeConfig = {
  autoCreateSupplyInvoice: process.env.AUTO_CREATE_SUPPLY_INVOICE !== 'false',
  autoCreateProductionAct: process.env.AUTO_CREATE_PRODUCTION_ACT !== 'false',
  enablePaymentAccrualFallback:
    process.env.ENABLE_PAYMENT_ACCRUAL_FALLBACK === 'true',
};
