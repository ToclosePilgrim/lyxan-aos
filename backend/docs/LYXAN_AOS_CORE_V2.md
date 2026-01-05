# Ly[x]an AOS — SCM, Production & Finance Core v2 Specification
## (Base Architecture Document for Cursor Agent — December 2025)

> This document is treated as the base reference for SCM / Production / Inventory (FIFO) / Finance logic in Ly[x]an AOS. Keep it versioned under `backend/docs/` and use it as the source of truth for upcoming tasks in the 2.x/3.x chains.

---

0. Purpose of Document  
Описывает фундаментальную архитектуру SCM, Производства, Запасов (Inventory), Финансового учёта себестоимости и Логистики для Ly[x]an AOS. Основа для реализации цепочек ТЗ 2.x и 3.x в ближайшие недели; гарантирует корректность на масштабе (1000+ SKU, несколько стран, десятки складов, сложные цепочки).

1. Core Architecture Overview  
Шесть доменов: Supplies, Transfers, Inventory (FIFO), Production, Finance, Accounting Layer (Ledger). Всё влияющее на себестоимость и остатки — движения + партии; цена партии фиксируется при приходе для traceability и P&L.

2. Supply Management (Закупки)  
- State machine: DRAFT → ORDERED → PARTIALLY_RECEIVED → RECEIVED → CLOSED  
- Partial receipts через SupplyReceipt; каждое поступление = INCOME движение (qty, price).  
- Финансы: при первом receipt авто SUPPLY_INVOICE (amount = qty * price, currency = supply.currency); при последующих — корректировка суммы.

3. Transfers (Перемещения)  
- State machine: REQUESTED → IN_TRANSIT → PARTIALLY_DELIVERED → DELIVERED  
- REQUEST → OUTCOME со склада A; DELIVERY → INCOME на склад B.  
- Цена входа — средневзвешенная цена списанных OUT партий.  
- Planned transfers возможны в Production (sourceType = TRANSFER).

4. Inventory Engine (FIFO)  
- Movements: INCOME, OUTCOME, TRANSFER_OUT, TRANSFER_IN, PRODUCTION_INPUT, PRODUCTION_OUTPUT, SCRAP, LOSS, ADJUSTMENT.  
- Batches: каждое INCOME создаёт StockBatch (qtyRemaining, unitCost, createdAt). OUTCOME списывает FIFO.  
- Stock Ledger: StockMovement с фильтрами warehouse/date/item/type.

5. Production  
- States: DRAFT → IN_PROGRESS → CONSUMED → COMPLETED → CLOSED.  
- Consumption: перед завершением все компоненты списаны FIFO; PRODUCTION_INPUT движения.  
- Output: PRODUCTION_OUTPUT движение + batch; unitCost = (materials + services + overhead) / producedQty.  
- Traceability: ProductionBatch (batchCode, expirationDate, qty, itemId) отображается в ledger.

6. Reservation Engine  
StockReservation(itemId, warehouseId, qty, reservedFor productionOrderId); резерв при планировании снабжения, снимается при списании.

7. Cost Allocation Engine  
Учитывает Materials (FIFO + логистика/таможня), Services (ServiceOperations), Overhead (OverheadAllocation: per-unit / per-order / per-labor-hour).

8. Finance Integration  
- FinancialDocument типы: SUPPLY_INVOICE, PRODUCTION_ACT, EXPENSE, OTHER.  
- Payments: PAID / PARTIALLY_PAID / UNPAID.  
- Auto-create: первая приемка supply → SUPPLY_INVOICE; завершение производства → PRODUCTION_ACT.

9. Accounting Layer (Ledger)  
AccountingEntry(debitAccount, creditAccount, amount, currency, docType, docId, createdAt).  
Примеры: Supply receipt → DR Inventory / CR AccountsPayable; Production completion → DR FinishedGoods / CR WorkInProgress; Payment → DR AP / CR Cash.

10. Required UI Enhancements  
- Вкладки: Supply → Finance; Production → Cost Details, Finance; Warehouse → Stock Ledger, Reservations.  
- Журналы: Movements, Batches, Reservations, Accounting Ledger.

11. Required Autotests (интеграционные)  
- Supply: partial receipts, корректная себестоимость, auto-finance docs.  
- Transfers: правильный IN/OUT, weighted avg cost.  
- Production: запрет complete без consumption, cost calc, batch creation.  
- FIFO: cross-warehouse checks, recomputation.

12. Roadmap Summary  
- Этап SCM v2: Partial receipts (critical), Transfer full impl, Provisioning v2 auto-triggers, Reservation Engine, Ledger.  
- Этап Production v2: Consumption, Batch traceability, Advanced cost allocation, Output warehouse.  
- Этап Finance v2: Auto-doc correctness, Payment workflows, Accounting ledger.

Финальный вывод: документ фиксирует масштабируемую ERP-совместимую архитектуру SCM → Inventory → Production → Finance с точным FIFO, себестоимостью и P&L, физической целостностью запасов.



















