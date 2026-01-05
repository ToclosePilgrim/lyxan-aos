# OS selfValidate: status репозитории и strict-режим

Цель: fail-fast на рассинхронизациях между Registry и Prisma при старте приложения.

Покрываемые статусные сущности сейчас:
- Supply (`ScmSupply.status`)
- SalesDocument (`SalesDocument.status`)
- InventoryAdjustment (`InventoryAdjustment.status`)
- StockTransfer (`ScmTransfer.status`)

STATUS_ENTITY_TO_REPO
- Маппинг `statusEntityName → prismaRepo` внутри `OsSelfValidateService`.
- Если маппинга нет → `OS_STATUS_REPO_NOT_MAPPED`.
- Если репо не имеет поля `statusFieldName` → `OS_STATUS_FIELD_INVALID`.

Режимы (`OS_SELF_VALIDATE_MODE`, дефолт strict):
- `strict` — логируем и падаем (использовать в dev/stage).
- `log` — логируем, но продолжаем.
- `off` — не запускаем selfValidate (не рекомендуется).

Definition of Done для новых сущностей:
- В Registry заданы `statusEntityName`, `statusFieldName`, `statusesDefinition`.
- В Prisma-модели реально есть поле статуса.
- STATUS_ENTITY_TO_REPO содержит нужный ключ.
- selfValidate проходит; при ломании маппинга/поля старт падает в strict-режиме.
















