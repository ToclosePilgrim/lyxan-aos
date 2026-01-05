# OS Lifecycle / Status Rules (ТЗ 6.3)

## Назначение
- Формально описать статусы объектов и допустимые действия.
- Проверять статус перед выполнением действия в OS Router.
- Заложить основу для будущих сценариев/mini-DSL (импорт → валидация → постинг).

## Модели
- `OsDomainObject`: `statusEntityName`, `statusFieldName`, `statusesDefinition` (JSON array).
- `OsDomainAction`: `allowedFromStatuses` (JSON array), `targetStatus`, `allowWhenNoStatus`.
- `OsLifecycle`: per-object lifecycle definition (code=DEFAULT), JSON with states/allowedActions.

## Примеры статусов
- SUPPLY: DRAFT, ORDERED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED.
  - CONFIRM_RECEIVE: allowedFrom ["ORDERED","PARTIALLY_RECEIVED"], target RECEIVED.
- SALES_DOCUMENT: IMPORTED, VALIDATED, POSTED, CANCELLED.
  - VALIDATE: allowedFrom ["IMPORTED"], target VALIDATED.
  - POST: allowedFrom ["VALIDATED"], target POSTED, isPostingAction=true.

## Поведение Router
- Перед вызовом handler:
  - Берёт object/action из реестра.
  - Читает текущий статус (по statusEntityName/statusFieldName) через Prisma.
  - Вызывает `ensureActionAllowedForStatus`.
  - При нарушении статуса — ошибка `OS_ACTION_INVALID_STATUS`/`OS_ACTION_STATUS_REQUIRED`.

## Расширение mini-DSL
- `OsLifecycle.definition` может содержать:
```
{
  "initialStatus": "DRAFT",
  "states": {
    "DRAFT": { "allowedActions": ["CONFIRM","CANCEL"] },
    "CONFIRMED": { "allowedActions": ["CONFIRM_RECEIVE","CANCEL"] },
    "PARTIALLY_RECEIVED": { "allowedActions": ["CONFIRM_RECEIVE","CANCEL"] },
    "RECEIVED": { "allowedActions": [] }
  },
  "scenarios": {
    "IMPORT_AND_POST": ["IMPORT", "VALIDATE", "POST"]
  }
}
```
  - Пока не используется в коде Router, но может применяться агентами/оркестраторами.

## Ошибки
- `OS_ACTION_INVALID_STATUS`: действие запрещено из текущего статуса.
- `OS_ACTION_STATUS_REQUIRED`: нужен статус, но не передан/не найден.

## Текущий seed (v0)
- SUPPLY: CONFIRM_RECEIVE (from ORDERED/PARTIALLY_RECEIVED → RECEIVED).
- SALES_DOCUMENT: POST (from IMPORTED/VALIDATED → POSTED), IMPORT_FROM_REPORTS, LIST, GET.
- INVENTORY_BALANCE: GET_BALANCES/GET_BATCHES/GET_MOVEMENTS (статуса нет).
- FINANCIAL_DOCUMENT: LIST, GET (статуса — из FinancialDocument).


