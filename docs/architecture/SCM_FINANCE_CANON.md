# SCM + Finance Canon (Source of Truth)

This is the **single source of truth** for runtime SCM + Inventory + Finance in Ly[x]an AOS.
If another document contradicts this one, **this document wins**.

---

## 1) Core principles (single path)

- **Single Source of Truth**: for each domain fact there must be **exactly one** canonical write path and one canonical read model.
- **No second paths**: legacy endpoints/services must be either:
  - deleted, or
  - kept as **deprecated aliases** that call the canonical service internally (read-only preferred).
- **Deny-by-default tenant isolation**: scope is enforced systemically (AsyncLocalStorage + scoped queries / allowed-warehouse filters).
- **Idempotency everywhere**:
  - HTTP-level: `Idempotency-Key` for mutating requests (global idempotency)
  - Domain-level: DB uniques (`idempotencyKey`) for critical write models
- **Base currency costing**: inventory costing and accounting use **base currency** (no mixed currency sums).
- **Always-on accounting validation in prod**: postings must be balanced (debit == credit) or the operation fails.

---

## 2) Inventory canon (SoT)

### Tables (SoT)
- **Movements**: `StockMovement`
- **Batches**: `StockBatch`
- **Balances (read-model)**: `InventoryBalance` (derived, not a source of truth)
- **Operation correlation**: `InventoryTransaction` links one operation → many movements

### Write path (only)
- **All inventory writes** go through:
  - `InventoryOrchestratorService` (operation orchestration + events + balance read-model update)
  - `FifoInventoryService` (batch selection and movement creation)

### Events
- `STOCK_CHANGED` is emitted **per StockMovement** for multi-batch FIFO OUT.
- `inventoryTransactionId` is used as correlationId across movement-level events.

### Idempotency
- `InventoryTransaction.idempotencyKey` is **unique**
- `StockMovement.idempotencyKey` is **unique**
- Multi-batch OUT generates distinct movement keys per batch/part.

---

## 3) Finance canon (SoT)

### Tables (SoT)
- **Ledger**: `AccountingEntry`
- **Posting versions**: `AccountingPostingRun`
- **Movement ↔ Ledger links**: `InventoryAccountingLink` (2 per movement: `COGS`, `INVENTORY`)

### Posting runs
- Postings create entries under a `PostingRun` and are concurrency-safe due to:
  - `@@unique([docType, docId, version])` on `AccountingPostingRun`
  - retry logic on `P2002` in `PostingRunsService`

### Always-on validation (prod)
- Any posting must pass balance validation (`sum(debit.amountBase) == sum(credit.amountBase)`).

### P&L
- P&L is computed **only** from ledger entries (`AccountingEntry`) using explicit `PNL_ACCOUNT_GROUPS`.
- No “document-based” P&L is allowed in runtime.

---

## 4) Sales documents canon

### SALE (SalesDocument posting)
- Inventory: FIFO OUT (`docType=SALE`, `docId=saleId`, meta contains `salesDocumentLineId`)
- Finance: revenue + marketplace fees + COGS/inventory entry
- Links: `InventoryAccountingLink` created for movements (2× per movement with `linkType`)

### SALE_RETURN (TZ 10.1: return with restock)
- Document: `SalesReturnOperation` (idempotent by `idempotencyKey`)
- Inventory: **IN** restock using **historical cost** from original SALE OUT movements (`meta.lineCostBase`)
- Finance:
  - Revenue reversal (contra-revenue / revenue debit)
  - COGS reversal is posted as **two entries via a clearing account** (to make links explainable):
    - Inventory entry: `DR inventory / CR inventory_cogs_clearing`
    - COGS entry: `DR inventory_cogs_clearing / CR cogs`
- Links:
  - Two link types (`COGS` + `INVENTORY`) are written for each return IN movement.
  - Invariant:
    - `linkType=INVENTORY` links must reference **inventory entry id**
    - `linkType=COGS` links must reference **cogs entry id**

FX/baseCurrency rule (MVP):
- `refundAmountBase` is expressed in **base currency** by contract.
- Revenue reversal entry for `SALE_RETURN` is posted in **baseCurrency** to avoid double FX and keep `amountBase` stable.

---

## 5) Agents canon

- `POST /api/agents/run` is **async**:
  - returns `202 Accepted`
  - enqueues BullMQ job (`agent-dispatch`)
- Callback endpoint is **secured**:
  - HMAC signature verification
  - replay protection via Redis
- Mutating endpoints used by agents/integrations must be idempotent.

---

## 6) OS / RAW / DWH (non-core)

- `FinanceReport` / RAW imports / DWH exports are **integration/staging layers**.
- They must not be used as runtime sources of truth for:
  - inventory balances
  - P&L
  - posting status
- Any raw/export endpoints must be **restricted** (superadmin-only) and clearly documented as non-core.

---

## 7) Deprecated (what NOT to use)

Deprecated docs live in `docs/deprecated/` and must not be used as a basis for architecture or code changes.

Deprecated APIs may exist only as:
- read-only aliases calling canonical services, with warning logs, and never as a second write path.


