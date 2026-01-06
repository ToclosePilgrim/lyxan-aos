# TZ 12.DOC.1 — Root Docs Hygiene (ROOT_DOCS_AUDIT)

Goal: repo root must not contain documents that compete with canonical SoT:
- `docs/product/**`
- `docs/architecture/**`
- `docs/runbooks/**`

Canonical links:
- Scope/goals: `docs/product/00-current-scope-and-goals.md`
- SCM+Finance canon: `docs/architecture/SCM_FINANCE_CANON.md`
- Deploy runbook: `docs/runbooks/deploy.md`

---

## Root docs audit table

| File | Status | Reason | Replacement link |
|---|---|---|---|
| `README.md` | KEEP (already rewritten) | Main entrypoint; now points to canonical docs only | `docs/product/*`, `docs/architecture/*`, `docs/runbooks/*` |
| `DEV_GUIDE.md` | KEEP (rewrite to thin index) | Useful as short navigation, but current content duplicates/conflicts with runbooks | `docs/runbooks/deploy.md` + canon docs |
| `TESTING.md` | KEEP (rewrite to thin index) | Useful as short navigation; current content is Patch-era and uses outdated commands | `docs/runbooks/e2e-ci.md` |
| `PROJECT_CONTEXT.md` | MOVE to archive | Claims to be “единой истиной” and contains outdated architecture/security claims | `docs/product/00-current-scope-and-goals.md` + `docs/architecture/SCM_FINANCE_CANON.md` |
| `PROJECT_STRUCTURE.md` | MOVE to archive | Duplicates README structure; quickly becomes stale | `README.md` |
| `SETUP_REPORT.md` | DELETE | One-off setup report; conflicts with current state | `docs/runbooks/deploy.md` |


