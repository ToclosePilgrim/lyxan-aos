-- TZ 8 — Base currency in FIFO/batches: store fixed FX rate used to compute unitCostBase
ALTER TABLE "stock_batches"
ADD COLUMN "fxRateToBase" DECIMAL(18, 8);


