# Тестовое размещение на Amvera

15.10.2026 владелец разрешил только тестовое развёртывание проекта margintoolsweb. Коммерческий запуск и реальные платежи запрещены. Remote Amvera: https://git.msk1.amvera.ru/kirillkostyuk/margintoolsweb. Адрес тестового сайта: https://margintoolsweb-kirillkostyuk.msk1.amvera.tech.

## Настройки проекта

Используется Docker и корневой контекст репозитория. Конфигурация `amvera.yaml` подготовлена по [документации Docker Amvera](https://docs.amvera.ru/applications/configuration/docker.html):

```yaml
meta:
  environment: docker
  toolchain:
    name: docker
    version: latest
build:
  dockerfile: infra/docker/Dockerfile
  skip: false
run:
  command: node
  args: infra/docker/amvera-start.mjs
  containerPort: 3000
  persistenceMount: /data
  singleton: true
  zeroDowntime: false
```

Docker Compose используется только локально; на Amvera PostgreSQL подключается отдельным сервисом. В `DATABASE_URL` указывается его доступный приложению адрес, не localhost контейнера сайта. Сборка запускается из корня: `docker build -f infra/docker/Dockerfile -t margintools:amvera-test .`.

Amvera запускает `node infra/docker/amvera-start.mjs` по command/args в YAML. Этот профиль принудительно задаёт production, порт 3000, указанный адрес сайта, STAGING_MODE=true, локальное хранилище /data/private с явным разрешением, BILLING_MODE=disabled, TEST_BILLING_ENABLED=false и SEED_DEMO=false. Он не позволяет выключить staging через окружение и не запускает Telegram-бота. Затем выполняется обычный `infra/docker/start.mjs`: проверка окружения и записи, `npm run db:migrate` (Prisma migrate deploy), идемпотентный `npm run db:seed`, HTTP. Без DATABASE_URL и секрета HTTP-защиты запуск остановится. Обычный Docker CMD без этого профиля сохраняет требование S3 для production. `migrate reset` не используется.

Развёртываемая ветка Amvera по документации — master. Перед первым push выполнить fetch, проверить refs и историю, затем отправить main:master без force. Если в Amvera уже есть свои коммиты, сначала изучить и согласовать конфигурацию. Авторизация только интерактивно в терминале: `git -c credential.helper= fetch amvera`, затем после проверки истории `git -c credential.helper= push amvera main:master`. Пароль вводится в запросе Git, не в командной строке, файле или URL. GitHub origin сохраняется отдельно.

15.10.2026 получена начальная ветка Amvera master с отдельной историей и одним файлом amvera.yml. Истории объединены без переписывания. Конфигурация сведена к единственному amvera.yaml: сохранены Dockerfile, порт, диск, singleton=true, zeroDowntime=false и явный build.skip=false. Добавлен обязательный защищённый профиль запуска; второй конфликтующий YAML-файл исключён.

## Переменные и секреты

Задать в интерфейсе Amvera; не помещать значения секретов в Git, YAML или Dockerfile.

| Переменная | Значение для тестового сайта |
| --- | --- |
| `DATABASE_URL` | Секрет: PostgreSQL connection string с действительными реквизитами |
| `APP_URL` | Полный HTTPS-адрес тестового сайта без завершающего `/` |
| `NODE_ENV` | `production` (уже задан в образе) |
| `PORT` | `3000` (уже задан в образе) |
| `STORAGE_MODE` | `local` |
| `PRIVATE_STORAGE_DIR` | `/data/private` |
| `ALLOW_LOCAL_STORAGE_IN_PRODUCTION` | `true` |
| `STAGING_MODE` | `true` |
| `STAGING_BASIC_AUTH_USER` | Логин внешней защиты тестового сайта, без `:` |
| `STAGING_BASIC_AUTH_PASSWORD` | Секрет: отдельный случайный пароль, не короче 16 символов |
| `BILLING_MODE` | `disabled` |
| `TEST_BILLING_ENABLED` | `false` |
| `SEED_DEMO` | `false` |

Секрет сессий (`SESSION_SECRET`, `AUTH_SECRET`, `NEXTAUTH_SECRET`) текущей реализации не нужен. Сессия — случайный 256-битный непрозрачный токен, его SHA-256 и срок действия хранятся в PostgreSQL. Cookie в production имеет Secure и HttpOnly. Перезапуск не аннулирует сессию, если база сохранилась. Для отзыва удалить соответствующие сессии через серверную логику; не менять переменные, которые приложение не использует.

Необязательно: `ADMIN_EMAIL` для продвижения зарегистрированного владельцем аккаунта при seed; `TELEGRAM_BOT_TOKEN` (секрет) и `TELEGRAM_BOT_USERNAME` для привязки бота; `MAIL_WEBHOOK_URL` для восстановления пароля; `AI_API_KEY` (секрет), `AI_BASE_URL`, `AI_MODEL` и лимиты для ИИ. Сам бот — отдельный процесс/сервис, сайт не запускает long polling. Не запускать два экземпляра бота с одним токеном.

## Диск и доступ

Смонтировать постоянный диск по `/data`. Приватные файлы сохраняются в `/data/private/<workspaceId>/`. Этот путь не связан с `public`, не отдаётся статически и не меняет расположение шрифтов PDF. Серверные маршруты сохраняют существующие проверки сессий, владельца и тарифных лимитов. HTTP-пароль не заменяет вход в аккаунт.

Текущий Dockerfile использует стандартного пользователя базового образа: root (UID 0). Проверяется фактическое создание и удаление временного файла в смонтированном каталоге; PDF создаются с правами 0600, новые приватные каталоги — 0700. При переопределении пользователя контейнера владелец диска должен предоставить этому UID права записи. Mount read-only не подходит; chmod 777 не нужен. Резервировать нужно и PostgreSQL, и `/data/private`.

Обычный production по умолчанию требует `STORAGE_MODE=s3`. Явное разрешение local — отдельное исключение для этого тестового размещения. Для S3 убрать флаг либо установить false, задать приватный бакет и `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Каталог PRIVATE_STORAGE_DIR при S3 не используется.

Тестовый режим защищает страницы, API, статические ресурсы и публичные ссылки Basic Auth. Передача пароля только через HTTPS. Без заданного пароля режим закрыт; браузер запросит его при первом посещении. `robots.txt` содержит Disallow: /, sitemap пустой, ответы содержат X-Robots-Tag: noindex, nofollow, noarchive. Это защита тестовой площадки; индексирование отключено дополнительно к паролю. Реальные платежи не подключены, тестовые платежи в production запрещены даже при попытке включить TEST_BILLING_ENABLED.

## Локальная проверка образа

Проверочные скрипты находятся в `tests/deployment/`. Они используют отдельную базу `margintools_amvera_verify`, отдельный Docker volume и случайные временные секреты в `/tmp`, не затрагивая рабочие аккаунты.

1. Запустить локальную PostgreSQL через Compose и создать отдельную пустую базу `margintools_amvera_verify` (один раз).
2. Выполнить `node tests/deployment/prepare.mjs`. Скрипт создаёт `/tmp/margintools-amvera-verify.env` с правами 0600 и не выводит секреты.
3. Собрать образ из корня и запустить контейнер:

```sh
docker run -d --name margintools-amvera-verify --network docker_default --env-file /tmp/margintools-amvera-verify.env -p 127.0.0.1:3003:3000 -v margintools_amvera_verify_data:/data -v /workspaces/VSCode/tests/deployment:/verification:ro margintools:amvera-test
docker exec margintools-amvera-verify node /verification/amvera-smoke.mjs create
```

Дождаться запуска сервера перед проверкой. Имя сети и путь `/verification` адаптировать для другого checkout. Скрипт проверяет закрытие доступа, robots, sitemap, регистрацию, создание сделки и PDF через API, права PDF и блокировку оплаты.

4. Остановить и удалить только проверочный контейнер, затем повторить ту же команду docker run с прежним volume. Не удалять volume и не сбрасывать базу.
5. Выполнить `docker exec margintools-amvera-verify node /verification/amvera-smoke.mjs verify`. Проверяется побайтная сохранность PDF на диске, действительность сессии и выдача PDF после нового migrate deploy. Затем удаляется только созданный проверкой аккаунт.

Фактическая проверка прав диска и HTTPS в Amvera остаётся частью приёмки после разрешённого владельцем размещения. Локальная проверка не означает, что приложение опубликовано.

## Результаты проверки 14.10.2026

- Окончательный образ собран обычным Docker BuildKit из корневого контекста. Файлы `.env` и `apps/web/.env.local` отсутствуют в образе.
- На пустой отдельной PostgreSQL применились обе миграции через migrate deploy, seed создал продуктовую конфигурацию. После пересоздания контейнера migrate deploy сообщил, что новых миграций нет.
- Проверен HTTP на 0.0.0.0:3000, Basic Auth для сайта/API/ресурсов/ссылок, noindex, закрытый robots и пустой sitemap. HTTP-пароль не заменяет сессию пользователя: /api/me без сессии остаётся закрытым.
- Пользователь контейнера — UID 0. Проверка записи на смонтированном томе прошла, PDF создан через API с правами 0600. После удаления контейнера и запуска нового с тем же томом SHA-256 файла совпал, сессия в PostgreSQL сохранилась и выдача PDF снова прошла. Созданный проверкой аккаунт удалён после проверки.
- Без ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true и при read-only томе запуск завершился с кодом 1 до запуска HTTP. Оплата в production не выдала доступ к покупке.
- Прошли 18 модульных и 10 интеграционных проверок, TypeScript и production-сборка.

В текущем окружении Docker bridge разрешал DNS, но TCP между контейнерами завершался timeout. Поэтому проверка запуска и постоянного тома выполнена локально через `--network host` с DATABASE_URL, указывающим на 127.0.0.1:5433. Это ограничение локальной сети, не изменение конфигурации Amvera. При повторении в этом окружении заменить в обеих командах docker run `--network docker_default -p 127.0.0.1:3003:3000` на `--network host -e DATABASE_URL=postgresql://margintools:local_dev_only@127.0.0.1:5433/margintools_amvera_verify`; предварительно освободить локальный порт 3000. В Amvera указывать действительный адрес отдельной базы.
