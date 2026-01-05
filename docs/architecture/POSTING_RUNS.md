# PostingRuns (8.4 standard)

This document captures the standard for using `AccountingPostingRun` when creating, voiding, and reposting accounting entries.

## StatementLine fee postings

- When a statement line **creates** a new P&L fee entry (`docType=STATEMENT_LINE_FEE`) it **must** be created under an `AccountingPostingRun`:
  - `(docType=STATEMENT_LINE_FEE, docId=statementLineId, version=1)`
  - All created entries must have `postingRunId`.
  - Repost = void + new version (no in-place edits).

- When a statement line does **link-only** (anti-double-count) to an existing fee entry (e.g. from `SalesDocument`), it **must not** create a `PostingRun`.
  - Instead, the operation must be **reversible** via an explicit unlink/unpost API, so the system can “undo” the link without touching ledger immutability.



