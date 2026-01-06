-- TZ 8.3.C.6.1: Harden test seed API by introducing explicit AccountingDocType.TEST_SEED
ALTER TYPE "AccountingDocType" ADD VALUE IF NOT EXISTS 'TEST_SEED';






