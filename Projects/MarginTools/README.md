# MarginTools

Русскоязычный сервис расчётов, сделок и коммерческих предложений.

Разработка ведётся по [ТЗ](docs/product-spec.md). Статус и проверки: [план](docs/status.md).

## Локальный запуск

Требуются Node.js 24+, npm и Docker Compose.

Все следующие команды выполнять из `margintools/`, а не из корня общего репозитория. Конфигурация `amvera.yaml` находится уровнем выше; Docker собирается из корня репозитория командой `docker build -f margintools/infra/docker/Dockerfile -t margintools .`.

```sh
npm ci
cp .env.example .env
cp .env.example apps/web/.env.local
docker compose -f infra/docker/compose.yml up -d
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Открыть http://localhost:3000. Регистрация создаёт бесплатное рабочее пространство. В кабинете подписки доступна явно обозначенная тестовая оплата без списания денег. В production она отключена.

Чтобы получить администратора, зарегистрировать аккаунт, указать его email в ADMIN_EMAIL в `.env` и повторить `npm run db:seed`. Для тестовых аккаунтов установить SEED_DEMO=true и DEMO_PASSWORD (не меньше 10 символов), затем запустить seed. Адреса: demo@margintools.local и admin@margintools.local. Пароль задаётся владельцем, встроенных паролей нет.

```sh
npm run typecheck
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run build
```

Браузерные тесты требуют работающий `npm run dev` и локальную PostgreSQL. Telegram запускается отдельно командой `npm run bot` после заполнения токена и имени бота. Переменные сайта читаются из apps/web/.env.local, бот и CLI используют корневой .env; при настройке поддерживайте их согласованность.

Документация: [архитектура](docs/architecture.md), [расчёты](docs/calculation-rules.md), [бот](docs/bot-scenarios.md), [развёртывание и резервные копии](docs/deployment.md), [проверки](docs/test-plan.md).

Тестовое размещение через Docker: [настройки Amvera](docs/amvera.md). Конфигурация подготовлена в [amvera.yaml](../amvera.yaml); публикация выполняется только по отдельному указанию владельца.

Реальный эквайринг не реализован. Telegram @MarginToolsbot подключён в локальном окружении владельца; токен не включён в исходники и примеры конфигурации. Для новой установки нужно предоставить собственный токен. ИИ, почта и S3 требуют внешних реквизитов и проверки подключения. Юридические тексты пока обозначены как неутверждённые. Публичная публикация не выполнялась. Точный статус и ограничения перечислены в [docs/status.md](docs/status.md).
