# Дерево файлов Backend

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.service.ts
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   └── users.service.ts
│   │   ├── org/
│   │   │   ├── org.module.ts
│   │   │   ├── org.controller.ts
│   │   │   └── org.service.ts
│   │   ├── scm/
│   │   │   ├── scm.module.ts
│   │   │   ├── scm.controller.ts
│   │   │   └── scm.service.ts
│   │   ├── bcm/
│   │   │   ├── bcm.module.ts
│   │   │   ├── bcm.controller.ts
│   │   │   └── bcm.service.ts
│   │   ├── finance/
│   │   │   ├── finance.module.ts
│   │   │   ├── finance.controller.ts
│   │   │   └── finance.service.ts
│   │   ├── advertising/
│   │   │   ├── advertising.module.ts
│   │   │   ├── advertising.controller.ts
│   │   │   └── advertising.service.ts
│   │   ├── support/
│   │   │   ├── support.module.ts
│   │   │   ├── support.controller.ts
│   │   │   └── support.service.ts
│   │   ├── analytics/
│   │   │   ├── analytics.module.ts
│   │   │   ├── analytics.controller.ts
│   │   │   └── analytics.service.ts
│   │   ├── settings/
│   │   │   ├── settings.module.ts
│   │   │   ├── settings.controller.ts
│   │   │   └── settings.service.ts
│   │   └── agents/
│   │       ├── agents.module.ts
│   │       ├── agents.controller.ts
│   │       └── agents.service.ts
│   ├── common/
│   │   ├── filters/
│   │   │   ├── all-exceptions.filter.ts
│   │   │   └── http-exception.filter.ts
│   │   ├── guards/
│   │   │   └── roles.guard.ts
│   │   ├── interceptors/
│   │   │   └── logging.interceptor.ts
│   │   └── decorators/
│   │       └── current-user.decorator.ts
│   ├── config/
│   │   └── config.module.ts
│   ├── database/
│   │   ├── database.module.ts
│   │   ├── prisma.service.ts
│   │   ├── redis.module.ts
│   │   └── redis.service.ts
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   └── schema.prisma
├── .env.example
├── package.json
└── README.md
```



























