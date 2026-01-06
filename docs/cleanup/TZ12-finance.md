# TZ 12 — Cleanup (Finance): single source of truth + legacy path audit

## Canon (SoT)

- **Ledger**: `AccountingEntry`
- **Posting versions**: `AccountingPostingRun` (via `PostingRunsService`)
- **Validation**: `AccountingValidationService` (always-on in prod)
- **P&L**: computed **only from ledger** (`FinanceService.getPnl`)

## Findings

### 1) Direct ledger writes are centralized

- All Prisma writes to `accountingEntry` are concentrated in:
  - `backend/src/modules/finance/accounting-entry/accounting-entry.service.ts`

This matches the “single write gateway” rule (posting services call into it, rather than calling Prisma directly).

## Guardrails

- `backend/src/common/guardrails/no-direct-ledger-writes.spec.ts`
  - CI fails if any non-test code outside `AccountingEntryService` uses:
    - `.accountingEntry.(create|update|upsert|delete...)`


