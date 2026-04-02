# Missing Features — PRO vs Original Projects

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

## ПРИОРИТЕТ ИСПРАВЛЕНИЙ

### Волна 1 — Критические сервисы
1. Email templates (5 методов)
2. Notification service (6 методов)  
3. Notifications + email dual-send
4. Payment funnel triggers + referral logic
5. Balance service return values + adminAdjust

### Волна 2 — Remnawave + утилиты
6. Remnawave missing methods
7. Utils/helpers file
8. Missing scripts (create-admin, notify-expiry, seed)

### Волна 3 — Frontend + автоматизация
9. Present/privacy/terms pages
10. Server alerts cron
11. Recurring payment executor
