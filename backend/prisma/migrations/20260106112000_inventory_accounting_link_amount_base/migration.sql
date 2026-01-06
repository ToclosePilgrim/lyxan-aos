-- TZ 10 — Sales posting explainability: store base amount per movement↔entry link
ALTER TABLE "inventory_accounting_links"
ADD COLUMN "amountBase" DECIMAL(18, 6);
