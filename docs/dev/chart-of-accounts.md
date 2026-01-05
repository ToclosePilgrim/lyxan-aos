# Chart of Accounts (AOS v0)

## 1. Principles
- Все проводки создаются только по счетам из `ACCOUNTING_ACCOUNTS`.
- Каждый счет относится к категории (Asset / Liability / Revenue / Expense).
- P&L считается по группам счетов (`PNL_ACCOUNT_GROUPS`), без хардкода строковых значений в сервисах.

## 2. Accounts (минимальный набор)

### Assets
- INVENTORY_MATERIALS — Запасы сырья (`10.01`)
- INVENTORY_FINISHED_GOODS — Запасы готовой продукции (`10.02`)
- ACCOUNTS_RECEIVABLE_MARKETPLACE — Расчеты с маркетплейсом (`62.01`)
- CASH (BANK/OTHER) — Денежные средства (`51.01` / `50.01`)

### Liabilities
- ACCOUNTS_PAYABLE_SUPPLIERS (`60.01`)
- ACCOUNTS_PAYABLE_TAXES (`68.01`)

### Revenue
- SALES_REVENUE (`90.01`)
- OTHER_OPERATING_REVENUE (`90.01.1`)

### COGS / Fees / Refunds / Logistics
- COGS (`90.02`)
- MARKETPLACE_FEES (`90.02.1`)
- LOGISTICS_EXPENSES (`90.02.2`)
- SALES_REFUNDS (`90.02.3`)

### OPEX (to be expanded)
- RENT_EXPENSE (`26.01`)
- SALARIES (`26.02`)
- MARKETING_EXPENSES (`26.03`)

## 3. P&L Groups
- REVENUE: SALES_REVENUE, OTHER_OPERATING_REVENUE
- COGS: COGS
- MARKETPLACE_FEES: MARKETPLACE_FEES
- REFUNDS: SALES_REFUNDS
- LOGISTICS: LOGISTICS_EXPENSES
- OPEX: RENT_EXPENSE, SALARIES, MARKETING_EXPENSES (и др. по мере добавления)

## 4. Calculation rules
- Доходы увеличиваются по кредиту счёта доходов → учитываются в P&L, если `creditAccount` ∈ REVENUE.
- Расходы/COGS/комиссии/возвраты/логистика/ОPEX учитываются, если `debitAccount` попадает в соответствующую группу.
- P&L использует `amountBase` (если заполнено) или `amount`.

















