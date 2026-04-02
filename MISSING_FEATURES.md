# Missing Features — PRO vs Original Projects

**Status: MOSTLY RESOLVED** — See completed items below

## CRITICAL — Сервисы (из /root/hideyou/)

### 1. Email Service — 5 template-методов отсутствуют
- `sendPaymentSuccess(email, tariffName, expireAt)` — подтверждение оплаты
- `sendExpiryWarning(email, daysLeft)` — предупреждение об истечении
- `sendWelcome(email)` — приветственное письмо
- `sendPasswordReset(email, code)` — сброс пароля
- `sendTrialOffer(email, trialDays)` — предложение пробного периода

### 2. Notification Service (notification-service.ts) — 6 из 7 методов
- `getUserNotifications(userId, opts)` — пагинация уведомлений
- `getUnreadCount(userId)` — счётчик непрочитанных
- `markAsRead(notificationId, userId)` — прочитать одно
- `markAllAsRead(userId)` — прочитать все
- `sendBroadcast(params)` — массовая рассылка in-app
- `sendToUsers(params)` — отправка группе

### 3. Notifications (notifications.ts) — пропущенные методы
- `referralBonus(userId, bonusDays)` — уведомление о реф.бонусе
- `referralBonusMoney(userId, amount)` — уведомление о денежном бонусе
- `sendCustom(userId, title, message)` — произвольное уведомление
- ВСЕ методы должны слать и Telegram И Email (сейчас только TG)

### 4. Payment Service — потерянная логика
- Funnel triggers: `triggerEvent('payment_success')` и `triggerEvent('referral_paid')`
- Полная реферальная логика (days + money + both), уведомления реферреру
- ЮKassa webhook IP verification

### 5. Remnawave Service — 50% методов
- `syncUserSubscription(uuid)` — полная синхронизация с traffic%
- `getAllUsers(start, size)` — пагинированный список
- `enableUser(uuid)` / `disableUser(uuid)`
- `findOrCreateUser(params)` — умное создание
- `getInternalSquads()` — список сквадов
- `getUsersByTag(tag)` — поиск по тегу
- `getSystemStats()` / `getNodesMetrics()`

### 6. Balance Service — потерянные возвраты и admin
- `adminAdjust(params)` — ручная корректировка баланса
- `credit()` / `debit()` должны возвращать { transaction, balance }
- `getBalance()` должен возвращать { balance, history }

### 7. Utils/Helpers — отсутствует файл целиком
- `RateLimiter` class
- `sleep()`, `chunk()`, `formatBytes()`, `formatDaysRu()`, `safeJson()`, `generateCode()`

### 8. Scripts — 3 отсутствуют
- `create-admin.ts` — создание админа
- `notify-expiry.ts` — крон уведомлений об истечении
- `seed.ts` — сидирование БД

## HIGH — Frontend (из /root/hideyou/)

### 9. Страницы
- `/present/[code]/page.tsx` — страница активации подарка
- `/privacy/page.tsx` — политика конфиденциальности
- `/terms/page.tsx` — условия использования

## MEDIUM — Бухгалтерия (из buhgalteria)

### 10. Автоматизация (схема есть, логики нет)
- Server payment alerts — нет крон-джоба для оповещений
- Recurring payment executor — нет авто-создания транзакций
- Milestone auto-tracking — нет привязки к агрегациям

### 11. Аналитика
- Partner ROI calculations — нет endpoint'а расчёта
- Campaign ROAS — нет привязки revenue к кампаниям
- PDF отчёты (только Excel сейчас)

---

## RESOLVED

- [x] Email templates (5 methods) — Wave 1
- [x] Notification service (6 methods) — Wave 1
- [x] Notifications dual TG+Email + referralBonus/Money/sendCustom — Wave 1
- [x] Payment funnel triggers + full referral logic — Wave 1
- [x] Balance service adminAdjust + return values — Wave 1
- [x] Utils/helpers (RateLimiter, sleep, chunk, formatBytes...) — Wave 1
- [x] Scripts: create-admin, notify-expiry — Wave 1
- [x] Remnawave full parity (~12 methods) — Wave 2
- [x] Seed script — Wave 2
- [x] Frontend: /present/[code], /privacy, /terms — Wave 3
- [x] Server alerts cron (notify-servers.ts) — Wave 3
- [x] Recurring payment executor (process-recurring.ts) — Backlog
- [x] @ts-nocheck removed from 10/16 files — Backlog

## REMAINING BACKLOG

- 6 files still have @ts-nocheck (need schema field alignment)
- Partner ROI calculation endpoint
- Campaign ROAS (revenue attribution to UTM)
- PDF report generation (only Excel now)
- Milestone auto-tracking from transaction aggregation
