# DEPRECATED — Inventory adjustments (historical notes)

This document is **deprecated**. Adjustment logic must follow the current inventory canon (orchestrator/FIFO) and base currency costing rules.

Canonical truth:
- `docs/architecture/SCM_FINANCE_CANON.md`

---

Original text (kept for history):

# Inventory adjustments: оценка излишков по средневзвешенной

Логика для положительных корректировок (qty > 0):
- unitCost берётся из текущей средневзвешенной себестоимости по складу/товару (агрегация по stockBatch с qty>0).
- Если средней нет (нет остатков):
  - если передан dto.unitCost — используем его,
  - иначе unitCost = 0 (fallback; предпочтительно избегать).
- totalCost = unitCost * quantity.

Проводки и события:
- AccountingEntry: gain/asset на сумму totalCost.
- INVENTORY.ADJUSTMENT_POSTED: payload содержит unitCost и totalCost, sourceDocType/Id, movementId, entryId.
- STOCK_CHANGED остаётся с единым контрактом.


