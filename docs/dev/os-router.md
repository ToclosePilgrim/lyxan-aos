# OS Router / Dispatcher

## Запрос
```
POST /os/v1/dispatch
{
  "object": "SUPPLY",
  "action": "CONFIRM_RECEIVE",
  "payload": { ... },
  "context": {
    "userId": "...",
    "role": "AGENT",
    "source": "AI_AGENT"
  }
}
```

## Ответ
`OsApiResponse`:
- success: true + data
- success: false + error { code, message, details? }

## Примеры
- SUPPLY.CONFIRM_RECEIVE
```
{
  "object": "SUPPLY",
  "action": "CONFIRM_RECEIVE",
  "payload": {
    "supplyId": "uuid",
    "items": [{ "supplyItemId": "uuid", "quantity": 10 }],
    "receivedAt": "2025-12-10T00:00:00Z"
  }
}
```
- SALES_DOCUMENT.POST
```
{
  "object": "SALES_DOCUMENT",
  "action": "POST",
  "payload": { "salesDocumentId": "uuid" },
  "context": { "role": "SYSTEM" }
}
```

## Поведение
- Router ищет object/action в `OsRegistryService`.
- Проверяет доступ (role, enabledForAgents/requiredRole).
- Через DI вызывает нужный сервис/метод.
- Возвращает результат или ошибку.

## Текущие маппинги (v0)
- SUPPLY.CONFIRM_RECEIVE → `ScmSuppliesService.confirmReceive`
- SUPPLY.LIST → `ScmSuppliesService.findAll`
- SALES_DOCUMENT.POST → `SalesDocumentsService.postSalesDocument`
- SALES_DOCUMENT.IMPORT_FROM_REPORTS → `SalesDocumentsService.importFromReports`
- SALES_DOCUMENT.LIST → `SalesDocumentsService.list`
- SALES_DOCUMENT.GET → `SalesDocumentsService.getById`
- INVENTORY_BALANCE.GET_BALANCES → `InventoryReportService.getBalances`
- INVENTORY_BALANCE.GET_BATCHES → `InventoryReportService.getBatches`
- INVENTORY_BALANCE.GET_MOVEMENTS → `InventoryReportService.getMovements`

## Расширение
- Добавлять actions в `OsRegistryService`.
- Адаптеры payload → DTO можно внедрить позже, сейчас payload передаётся как есть в handler.

