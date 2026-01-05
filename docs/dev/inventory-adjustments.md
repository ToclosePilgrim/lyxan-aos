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

Почему так:
- Излишки капитализируются по той же средней цене, что и действующий запас.
- P&L отражает реальный финансовый эффект, без ручного ввода цены.
















