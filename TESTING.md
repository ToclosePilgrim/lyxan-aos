# Testing (thin index)

Canonical docs:
- SCM+Finance canon: `docs/architecture/SCM_FINANCE_CANON.md`
- E2E/CI required guardrails: `docs/runbooks/e2e-ci.md`

Typical commands:

```bash
# backend unit/integration
cd backend
pnpm test

# backend e2e (requires Postgres + Redis)
pnpm test:e2e

# frontend smoke (Playwright)
cd ../frontend
pnpm test:smoke
```

If this file conflicts with canon/runbooks, follow `docs/runbooks/e2e-ci.md`.



























