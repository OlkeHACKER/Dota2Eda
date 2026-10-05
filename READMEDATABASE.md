# Domashka Backend

Express + Prisma + PostgreSQL (Neon). Обслуживает фронтенд Domashka вместо
мок-данных из `src/data/mock.js`.

## Шаг 1. Установка

```bash
cd domashka-backend
npm install
```

## Шаг 2. База данных на Neon

1. Зарегистрируйтесь на https://neon.tech (можно через GitHub)
2. Создайте проект, например "domashka"
3. В разделе Connection Details скопируйте строку подключения
   (выглядит как `postgresql://user:password@host/dbname?sslmode=require`)

## Шаг 3. Настройка окружения

Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

Откройте `.env` и вставьте:
- `DATABASE_URL` — строку с Neon
- `JWT_SECRET` — любую длинную случайную строку (для подписи токенов)

## Шаг 4. Создание таблиц в базе

```bash
npx prisma migrate dev --name init
```

Эта команда создаст все таблицы (`users`, `restaurants`, `dishes`, `orders`,
`order_items`) в вашей базе на Neon на основе `prisma/schema.prisma`.

## Шаг 5. Тестовые данные (необязательно, но полезно для разработки)

```bash
npm run seed
```

Создаст один ресторан "Угли" с 3 блюдами, владельца ресторана и тестового
клиента. Логины выводятся в консоль после выполнения.

## Шаг 6. Запуск сервера

```bash
npm run dev
```

Сервер поднимется на http://localhost:5000. Откройте в браузере
http://localhost:5000 — должны увидеть `{"status":"ok", ...}`.

## Проверка через Postman/браузер

- `GET  /api/restaurants` — список всех ресторанов с меню
- `GET  /api/restaurants/1` — один ресторан
- `POST /api/auth/register` — регистрация (`{ name, email, password }`)
- `POST /api/auth/login` — вход (`{ email, password }`)
- `POST /api/orders` — создать заказ (нужен токен, `Authorization: Bearer <token>`)
- `GET  /api/orders/my` — мои заказы (нужен токен)
- `PATCH /api/orders/1/status` — сменить статус (только владелец ресторана)

## Полезная команда

`npx prisma studio` — открывает визуальный редактор базы данных в браузере,
можно смотреть и редактировать данные глазами, без SQL-запросов.

## Дальше

Когда backend работает локально — переходите к подключению фронтенда:
замените импорты из `data/mock.js` на запросы через axios к
`http://localhost:5000/api/...`.
