# Инструкция по пересборке Docker для AOS

## Проблема
После добавления функционала интеграций маркетплейсов страницы не работают в Docker (404).

## Решение
Dockerfile.frontend был обновлен для сборки Next.js внутри контейнера из исходников.

## Шаги для пересборки

### 1. Остановить текущие контейнеры
```bash
cd infra
docker compose down
```

### 2. Пересобрать образы frontend и backend
```bash
docker compose build frontend backend
```

### 3. Поднять сервисы
```bash
docker compose up -d frontend backend postgres redis
```

### 4. Проверить статус
```bash
docker compose ps
```

Все сервисы должны быть в статусе `Up`.

### 5. Проверить логи
```bash
# Логи frontend
docker compose logs frontend --tail=100

# Логи backend
docker compose logs backend --tail=100
```

### 6. Проверить содержимое контейнера (опционально)
```bash
# Войти в контейнер frontend
docker compose exec frontend sh

# Проверить наличие страниц
ls -la app/app/(protected)/settings/marketplace-integrations
ls -la app/.next/server/app/(protected)/settings/marketplace-integrations

# Выйти
exit
```

### 7. Проверить в браузере
- Открыть http://localhost:3000/settings
- Убедиться, что видна карточка "Marketplace Integrations"
- Перейти на http://localhost:3000/settings/marketplace-integrations
- Должен отображаться список интеграций (или пустой список + кнопка "Add integration")

## Что было исправлено

1. **Dockerfile.frontend** - теперь собирает Next.js внутри контейнера:
   - Копирует весь исходный код frontend
   - Выполняет `pnpm build` внутри контейнера
   - Копирует собранный `.next` в production stage

2. **Проверена структура файлов**:
   - ✅ `frontend/app/(protected)/settings/page.tsx` - содержит карточку Marketplace Integrations
   - ✅ `frontend/app/(protected)/settings/marketplace-integrations/page.tsx` - страница списка
   - ✅ `frontend/app/(protected)/settings/marketplace-integrations/new/page.tsx` - страница создания
   - ✅ `frontend/app/(protected)/settings/marketplace-integrations/[id]/page.tsx` - детальная страница

3. **docker-compose.yml** - конфигурация корректна:
   - frontend собирается из `../frontend`
   - backend собирается из `../backend`




























