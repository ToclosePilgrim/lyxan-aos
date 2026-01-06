# TZ 12.DOC — Documentation Audit Map (KEEP / REWRITE / DEPRECATE / DELETE)

This file is the working inventory for the “Doc Refresh Sprint”.
Goal: **one canonical Source of Truth** for SCM + Finance + Agents, and no misleading “legacy as current”.

Legend:
- **KEEP**: canonical and up-to-date (may get small link refresh)
- **REWRITE**: keep the file but rewrite content to match current canon
- **DEPRECATE**: move/mark as deprecated; keep only for history with a pointer to canon
- **DELETE**: remove from repo (noise / one-off reports). If any unique nugget exists, copy 5–10 lines into canon first.

Canonical docs (new, created in this sprint):
- `docs/architecture/SCM_FINANCE_CANON.md`
- `docs/product/00-current-scope-and-goals.md`
- `docs/product/01-roadmap-operationalization.md`
- `docs/runbooks/*`

---

## A) Product / Architecture / Runbooks (SoT)

| Path | Status | Why | Replaced by |
|---|---|---|---|
| `docs/architecture/SCM_FINANCE_CANON.md` | KEEP | Single Source of Truth (SoT) for SCM+Finance, invariants & “no second path” rules | n/a |
| `docs/product/00-current-scope-and-goals.md` | KEEP | Current scope/goals (non-skeleton) | n/a |
| `docs/product/01-roadmap-operationalization.md` | KEEP | Operational roadmap with DoD | n/a |
| `docs/runbooks/deploy.md` | KEEP | Deploy/run instructions | n/a |
| `docs/runbooks/operations-checklist.md` | KEEP | Operational checks (SCM+Finance health) | n/a |
| `docs/runbooks/data-integrity.md` | KEEP | Monitoring/integrity invariants | n/a |
| `docs/runbooks/e2e-ci.md` | KEEP | Required guardrail e2e list | n/a |

---

## B) docs/ (existing)

| Path | Status | Why | Replaced by |
|---|---|---|---|
| `docs/architecture/POSTING_RUNS.md` | KEEP | PostingRuns standard + DB invariants + guardrail reference | `docs/architecture/SCM_FINANCE_CANON.md` (links) |
| `docs/architecture/CHANGE_REQUESTS.md` | REWRITE | Must reference canon + updated system invariants | `docs/architecture/SCM_FINANCE_CANON.md` |
| `docs/dev/guardrails.md` | REWRITE | Keep as dev rules, but must reference canon docs as SoT | `docs/architecture/SCM_FINANCE_CANON.md`, `docs/runbooks/e2e-ci.md` |
| `docs/dev/inventory-report-api.md` | REWRITE | Must match current inventory report endpoints (and scope rules) | `docs/architecture/SCM_FINANCE_CANON.md` |
| `docs/dev/inventory-events.md` | REWRITE | Needs to reflect multi-movement STOCK_CHANGED + correlationId | `docs/architecture/SCM_FINANCE_CANON.md` |
| `docs/dev/scm-stocks-api.md` | REWRITE | Previously described ScmStock SoT (removed). Must describe current deprecated alias policy + canon inventory reports | `docs/architecture/SCM_FINANCE_CANON.md` |
| `docs/dev/os-api-v1.md` | REWRITE | Must reflect OS API as integration layer; inventory endpoints are deprecated aliases; RAW/export is non-core | `docs/architecture/SCM_FINANCE_CANON.md` |
| `docs/dev/agents-dispatch-async.md` | REWRITE | Must reflect async queue + secure callback + idempotency | `docs/architecture/SCM_FINANCE_CANON.md` |
| `docs/dev/finance-report-usage.md` | KEEP (small refresh) | Correctly states FinanceReport is staging/RAW only; just needs explicit links to canon | `docs/architecture/SCM_FINANCE_CANON.md` |
| `docs/dev/bigquery-data-layer.md` | REWRITE | Should be aligned with “RAW is integration only; runtime reads CORE/read-models” | `docs/architecture/SCM_FINANCE_CANON.md` |
| `docs/deprecated/legacy-scm-usage.md` | DEPRECATE | Describes removed legacy tables/endpoints as current | `docs/architecture/SCM_FINANCE_CANON.md` |
| `docs/deprecated/inventory-adjustments.md` | DEPRECATE | Adjustment logic must be revalidated; kept as historical only | `docs/architecture/SCM_FINANCE_CANON.md` |
| `docs/dev/chart-of-accounts.md` | KEEP (small refresh) | Useful reference; must align with mapping service and base currency | `docs/architecture/SCM_FINANCE_CANON.md` |
| `docs/dev/os-*` (`os-lifecycle.md`, `os-registry.md`, `os-router.md`, `os-self-validate.md`) | REWRITE | Integration layer docs must be consistent and marked as non-core SoT | `docs/architecture/SCM_FINANCE_CANON.md` |
| `docs/dwh/*` | REWRITE | Must explicitly declare RAW/staging is non-core; runtime reads CORE/read-models only | `docs/architecture/SCM_FINANCE_CANON.md`, `docs/product/01-roadmap-operationalization.md` |
| `docs/DEPLOYMENT_LOCAL_STAGING.md` | REWRITE | Should defer to runbook `docs/runbooks/deploy.md` | `docs/runbooks/deploy.md` |
| `docs/BACKUP_AND_RESTORE.md` | KEEP | Still useful operational doc; add link to runbooks | `docs/runbooks/*` |
| `docs/cleanup/TZ12-*.md` | KEEP | Internal cleanup notes (not SoT, but useful for history) | `docs/architecture/SCM_FINANCE_CANON.md` |

---

## C) Root-level docs (*.md in repo root)

| Path | Status | Why | Replaced by |
|---|---|---|---|
| `README.md` | REWRITE | Must become doc navigation to canon; remove legacy pointers | `docs/product/*`, `docs/architecture/*`, `docs/runbooks/*` |
| `PROJECT_CONTEXT.md` | DEPRECATE | Previously declared itself as SoT; now superseded by canon docs | `docs/product/*`, `docs/architecture/SCM_FINANCE_CANON.md` |
| `DEV_GUIDE.md`, `TESTING.md`, `SETUP_REPORT.md`, `PROJECT_STRUCTURE.md` | DEPRECATE | Mixed/old; keep only if still accurate, otherwise link to runbooks | `docs/runbooks/*` |

---

## D) backend/**/*.md (noise policy)

**DELETE** (one-off reports/summaries that are misleading and not maintained):
- `backend/**/*REPORT*.md`
- `backend/**/*AUDIT*.md`
- `backend/**/*SUMMARY*.md`
- `backend/**/*FIX*.md`

If any file contains unique info, copy a short snippet into:
- `docs/architecture/SCM_FINANCE_CANON.md` (for invariants/policies)
- or `docs/runbooks/*` (for procedures)


