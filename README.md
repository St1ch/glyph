# GLYPH

GLYPH — минималистичная социальная платформа на `Next.js 16`, `React 19` и `MySQL`.

В проекте уже есть:
- аккаунты и сессии через cookie;
- профили с emoji-аватарами;
- лента постов, лайки, комментарии и репосты;
- кланы, вступление и публикация постов в кланы;
- уведомления и realtime через `WebSocket`;
- жалобы, верификация и админка;

## Локальный запуск

1. Установите зависимости:

```bash
npm install
```

2. Создайте `.env.local` на основе `.env.example`.

3. Поднимите MySQL и примените схему:

```bash
database/schema.sql
```

4. При необходимости импортируйте старые данные:

```bash
npm run db:import
```

5. Запустите проект:

```bash
npm run dev
```

## Основные переменные окружения

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_REALTIME_URL=ws://localhost:3002/ws
REALTIME_PORT=3002

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=nami_social

SMTP_HOST=smtp.timeweb.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@example.com
SMTP_PASS=
MAIL_FROM=no-reply@example.com
```

## Подготовка к хостингу

Перед выкладкой нужно:

1. Указать публичный адрес сайта в `NEXT_PUBLIC_APP_URL`.
2. Указать публичный адрес websocket-сервера в `NEXT_PUBLIC_REALTIME_URL`.
3. Настроить MySQL-подключение через `DB_*`.
4. Выполнить:

```bash
npm run build
npm run start
```

Если хостинг разносит HTTP и `WebSocket` по разным портам или доменам, проект уже поддерживает это через `NEXT_PUBLIC_REALTIME_URL`.

## Проверка перед релизом

```bash
npm run typecheck
npm run lint
```
