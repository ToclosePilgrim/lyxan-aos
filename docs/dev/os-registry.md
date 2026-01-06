# OS Registry (ТЗ 6.1)

Canonical architecture: `docs/architecture/SCM_FINANCE_CANON.md`.

## Назначение
- Централизованный реестр доменных объектов и действий (object/action) для OS Router, агентов, будущей генерации UI/доков/прав.
- Описывает: код объекта, домен, сервис, действия, ограничения, доступность для агентов.

## Модели в schema.prisma
- `OsDomainObject`: code, name, domain, entityName, serviceKey, apiBasePath, primaryKey, description, flags, actions[].
- `OsDomainAction`: code, handlerName, actionType (COMMAND|QUERY), httpMethod/httpPath, isPostingAction, allowedFromStatuses, targetStatus, enabledForAgents, requiredRole, schemas, etc.

## Текущий seed (in-memory v0)
- SUPPLY (`ScmSuppliesService`, /scm/supplies)
  - CONFIRM_RECEIVE (COMMAND, POST, allowedFrom: ORDERED/PARTIALLY_RECEIVED, target: RECEIVED, agents allowed)
  - LIST (QUERY)
- SALES_DOCUMENT (`SalesDocumentsService`, /finance/sales-documents)
  - POST (COMMAND, posting, target POSTED)
  - IMPORT_FROM_REPORTS (COMMAND)
  - LIST (QUERY)
  - GET (QUERY)
- INVENTORY_BALANCE (`InventoryReportService`)
  - GET_BALANCES (QUERY)
  - GET_BATCHES (QUERY)
  - GET_MOVEMENTS (QUERY)
- FINANCIAL_DOCUMENT (`FinancialDocumentsService`)
  - LIST (QUERY)
  - GET (QUERY)

## API (read-only)
- `GET /os/v1/registry/objects` — список объектов.
- `GET /os/v1/registry/objects/:code` — объект с действиями.
- `GET /os/v1/registry/objects/:code/actions/:action` — детали действия.

## Использование
- OS Router (6.2) резолвит object/action в serviceKey/handler.
- Агенты и отладка — могут читать реестр через API.

## Расширение
- Добавлять/изменять записи в `OsRegistryService` (seed) и/или в таблицы `os_domain_objects/os_domain_actions` в БД, затем мигрировать Router на чтение из БД.




















