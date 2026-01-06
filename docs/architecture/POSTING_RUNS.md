# PostingRuns (8.4 standard)

This document captures the standard for using `AccountingPostingRun` when creating, voiding, and reposting accounting entries.

## DB invariants (UNIQUE constraints) — what concurrency safety relies on

`PostingRunsService` implements concurrency-safe create/repost by catching Prisma `P2002` (unique constraint violation) during `accountingPostingRun.create(...)`, re-reading the latest state, and retrying.

This logic is correct **only if the DB enforces canonical uniqueness for posting run versions**:

- **Canonical unique (version key)**: `@@unique([docType, docId, version])`
  - Migration/index: `accounting_posting_runs_doc_ver_key` on `("docType","docId","version")`
  - This is the key that intentionally triggers `P2002` under concurrent creates of the same version.

- **Reversal/repost links are unique**:
  - `reversalRunId` is unique (a run can be reversed by at most one run)
  - `repostedFromRunId` is unique (a run can be reposted to at most one run)

Guardrail:
- `backend/src/common/guardrails/postingruns-unique.spec.ts` ensures the canonical `@@unique([docType, docId, version])` cannot be removed from Prisma schema without CI failing.

## StatementLine fee postings

- When a statement line **creates** a new P&L fee entry (`docType=STATEMENT_LINE_FEE`) it **must** be created under an `AccountingPostingRun`:
  - `(docType=STATEMENT_LINE_FEE, docId=statementLineId, version=1)`
  - All created entries must have `postingRunId`.
  - Repost = void + new version (no in-place edits).

- When a statement line does **link-only** (anti-double-count) to an existing fee entry (e.g. from `SalesDocument`), it **must not** create a `PostingRun`.
  - Instead, the operation must be **reversible** via an explicit unlink/unpost API, so the system can “undo” the link without touching ledger immutability.






