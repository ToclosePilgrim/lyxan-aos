# Architecture Change Requests (ACR)

This repository enforces certain **domain boundaries** (e.g. MDM ↔ SCM ↔ Finance) via ADRs, contract tests, and guardrail scripts.

If you need to change a boundary, you must do it explicitly via an **Architecture Change Request (ACR)**.

## When ACR is required

Create an ACR if your change touches any of the following:

- Introducing/removing/renaming a “source of truth” (SoT) entity (e.g. Counterparty, Item master, Accounts).
- Moving ownership of an entity between domains (MDM/SCM/Finance).
- Adding new cross-domain foreign keys or APIs that create coupling.
- Relaxing or removing architecture guardrails (lockdown scripts / contract tests).

## ACR rules

- **Separate PR** dedicated to the boundary change.
- **Explain the motivation**: what problem is being solved and why the current boundary is insufficient.
- **Describe the migration plan**:
  - data migration (if any)
  - backwards compatibility period (if any)
  - cleanup plan for legacy paths
- **Update ADR(s)**:
  - amend the relevant ADR or add a new one
- **Update guardrails**:
  - adjust `check:architecture-lockdown` and contract tests *only* if ADR/ACR explicitly approves it.

## Required links in PR description

- Link to the ADR(s) affected
- Link to the ACR PR itself (if this PR is not the ACR PR)




