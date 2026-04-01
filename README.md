# HIDEYOU PRO

**VPN Management + Accounting Platform**

Единая платформа для управления VPN-сервисом: подписки, платежи, бухгалтерия, маркетинг, партнёры, аналитика, Telegram-бот с no-code конструктором.

## Требования к серверу

| Ресурс | Минимум | Рекомендуется |
|--------|---------|---------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4 GB |
| Диск | 20 GB SSD | 40 GB SSD |
| ОС | Ubuntu 20.04+ / Debian 11+ | Ubuntu 22.04 LTS |
| Порты | 80, 443 | 80, 443 |

## Быстрая установка

```bash
git clone https://github.com/ChernOvOne/HIDEYOUPRO.git /root/hideyoupro
cd /root/hideyoupro
bash install.sh install
```

Установщик спросит только **домен** — всё остальное настраивается в браузере через Setup Wizard при первом входе.

## Управление

```bash
hyp              # Интерактивное меню
hyp status       # Статус сервисов
hyp update       # Обновление
hyp backup       # Резервная копия
hyp logs         # Просмотр логов
hyp start/stop   # Запуск/остановка
```

## Архитектура

```
┌─────────────┐     ┌──────────────┐     ┌──────────┐
│   Nginx     │────▶│  Frontend    │     │   Bot    │
│   :80/:443  │     │  Next.js     │     │  grammy  │
└──────┬──────┘     └──────────────┘     └────┬─────┘
       │                                       │
       ▼                                       ▼
┌──────────────┐     ┌──────────┐     ┌──────────────┐
│   Backend    │────▶│ Postgres │◀────│    Redis     │
│   Fastify    │     │   16     │     │      7       │
└──────────────┘     └──────────┘     └──────────────┘
```

## Стек

- **Backend:** Fastify 4 + TypeScript + Prisma ORM
- **Frontend:** Next.js 14 + React 18 + Tailwind CSS + Recharts
- **Database:** PostgreSQL 16 + Redis 7
- **Bot:** grammy + No-Code Block Engine
- **Infrastructure:** Docker Compose + Nginx + Let's Encrypt

## Функции

### VPN Management (из HideYou)
- Интеграция с REMNAWAVE (подписки, устройства, трафик)
- Тарифы с вариантами цен
- Платежи: ЮKassa, CryptoPay, баланс
- Реферальная программа
- Пробный период
- Telegram MiniApp
- Лендинг с настройками из админки
- Автоворонки (40+ триггеров)
- No-code конструктор бота (10 типов блоков)

### Accounting (из Бухгалтерии)
- Доходы и расходы с категориями
- Авто-тегирование транзакций
- Партнёры и инвесторы (доли, дивиденды)
- Учёт серверов (стоимость, напоминания)
- Рекламные кампании + UTM-трекинг
- Воронка: клик → лид → конверсия
- PDF/Excel отчёты
- Сравнение периодов
- Бизнес-цели (milestones)
- Аудит лог

### Объединённое
- Единый дашборд: VPN метрики + финансы
- Оплата подписки → автоматический доход в бухгалтерии
- Пользователь = клиент (LTV, UTM-атрибуция, подписка)
- Расширенные роли: Admin, Editor, Investor
- TG-уведомления по событиям (доход, расход, оплата, сервер)
- Setup Wizard при первом входе

## Безопасность

- JWT в httpOnly cookies (не localStorage)
- bcrypt хеширование паролей (cost 12)
- Rate limiting на всех эндпоинтах
- RBAC — проверка роли на каждом route
- Security headers (HSTS, X-Frame-Options, CSP)
- Input validation через Zod
- SQL injection защита (Prisma ORM)
- XSS защита (React auto-escaping)
- API ключи для вебхуков (хешированные)
- Аудит лог всех действий
- HTTPS only в production

## Сервисы Docker

| Сервис | Контейнер | RAM |
|--------|-----------|-----|
| PostgreSQL 16 | hyp_postgres | ~200 MB |
| Redis 7 | hyp_redis | ~50 MB |
| Backend (Fastify) | hyp_backend | ~150 MB |
| Frontend (Next.js) | hyp_frontend | ~200 MB |
| Telegram Bot | hyp_bot | ~80 MB |
| Nginx | hyp_nginx | ~20 MB |
| **Итого** | | **~700 MB** |

## Лицензия

MIT
