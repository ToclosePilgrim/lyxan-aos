# ARCHIVED — Project structure (historical)

ARCHIVED: this document is **not** a Source of Truth and may be outdated.

Current canonical docs:
- `README.md`
- `docs/product/00-current-scope-and-goals.md`
- `docs/architecture/SCM_FINANCE_CANON.md`
- `docs/runbooks/deploy.md`

---

# Структура проекта Ly[x]an AOS

## Дерево файлов (без node_modules)

```
/aos
├── package.json
├── pnpm-workspace.yaml
├── README.md
├── PROJECT_STRUCTURE.md
├── /backend
│   ├── package.json
│   ├── nest-cli.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── eslint.config.mjs
│   ├── .prettierrc
│   ├── /src
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   └── /modules
│   │       └── .gitkeep
│   └── /test
│       ├── jest-e2e.json
│       └── app.e2e-spec.ts
├── /frontend
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── eslint.config.mjs
│   ├── postcss.config.mjs
│   ├── /app
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   └── /public
│       ├── next.svg
│       ├── vercel.svg
│       └── ...
├── /shared
│   ├── package.json
│   ├── index.ts
│   └── /types
│       └── index.ts
└── /infra
    ├── package.json
    ├── README.md
    ├── Dockerfile.backend
    ├── Dockerfile.frontend
    └── docker-compose.yml
```

## Ключевые файлы

### Корневой package.json
```json
{
  "name": "lyxan-aos",
  "private": true,
  "version": "0.1.0"
}
```

### pnpm-workspace.yaml
```yaml
packages:
  - "backend"
  - "frontend"
  - "shared"
  - "infra"
```

### Backend (NestJS)
- Пустой AppModule без примерных контроллеров
- Структура `src/modules` для будущих модулей
- Готов к расширению

### Frontend (Next.js)
- App Router
- Минимальный layout
- Главная страница с текстом "Ly[x]an AOS Frontend Initialized"

### Shared
- Экспортирует тип `AOS_Marker = "shared-initialized"`
- Структура для общих типов и констант

### Infra
- Dockerfile шаблоны для backend и frontend
- docker-compose.yml шаблон

## Команды

### Установка зависимостей
```bash
pnpm install
```

### Запуск Backend
```bash
pnpm -F backend start
```

### Запуск Frontend
```bash
pnpm -F frontend dev
```


