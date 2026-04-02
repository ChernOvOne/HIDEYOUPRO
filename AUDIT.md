# HIDEYOU PRO — Full Code Audit

**Date:** 2026-04-02  
**Status:** Phase 1-4 DONE, Phase 5 pending

**Progress:**
- Phase 1 (Critical bugs): DONE — C1-C10 fixed
- Phase 2 (Security): DONE — H4,H5,H7,H8,C8 fixed
- Phase 3 (Performance): DONE — H1,H2,H3,H6,H10,H12 fixed
- Phase 4 (Code quality): DONE — M1(partial),M3,M11,M13,M14 fixed
  - 6 files freed from @ts-nocheck, 10 remain (need schema migration)
  - M5 (audit logging) deferred — requires per-endpoint changes
- Phase 5 (Polish): PENDING

---

## CRITICAL (must fix immediately)

### C1. Payment status field stores JSON instead of enum
**File:** `backend/src/routes/payments.ts:110`  
Storing `JSON.stringify(paymentMeta)` in `status` field breaks all `status === 'PAID'` checks across the system.

### C2. Payment verification is a stub (TODO)
**File:** `backend/src/routes/payments.ts:164-186`  
`null as any` — endpoints always fail. Users can never verify payment status.

### C3. Missing email service methods
**File:** `backend/src/services/email.ts`  
`sendGiftNotification()` and `sendVerificationCode()` called from gift.ts and verification.ts but don't exist. Runtime crash.

### C4. Gift service calls remnawave.extendSubscription() with wrong args
**File:** `backend/src/services/gift.ts:135-139`  
3 args passed but function accepts 2. Third arg silently ignored.

### C5. Gift service missing trafficLimitBytes in createUser()
**File:** `backend/src/services/gift.ts:114-121`  
Will create REMNAWAVE users with incorrect/zero traffic limits.

### C6. Race condition in gift claiming
**File:** `backend/src/services/gift.ts:80-104`  
No transaction — two concurrent requests can claim same gift.

### C7. Race condition in promo usage
**File:** `backend/src/routes/promo.ts:227-231`  
usedCount can exceed maxUses with concurrent requests.

### C8. Secrets exposed in .env (in git)
**File:** `.env`  
JWT_SECRET, COOKIE_SECRET, POSTGRES_PASSWORD, REDIS_PASSWORD — all real values in repo.

### C9. XSS via dangerouslySetInnerHTML + broken markdown sanitizer
**File:** `frontend/src/app/dashboard/instructions/page.tsx:293`  
renderMd() adds HTML tags before escaping. `**<script>**` becomes `<strong><script></strong>`.

### C10. Admin pages not protected by middleware
**File:** `frontend/src/middleware.ts:8-26`  
`/api` routes pass through without auth check. Admin role not verified in middleware.

---

## HIGH (fix soon)

### H1. N+1 query in promo stats
**File:** `backend/src/routes/promo.ts:103-114`  
Loop queries DB for each promo usage. Should batch with `findMany()`.

### H2. Sequential broadcast sending blocks server
**File:** `backend/src/routes/admin-broadcast.ts:125-156`  
1000 users = 1000+ seconds blocking. Need batched `Promise.all()`.

### H3. Broadcast race condition
**File:** `backend/src/routes/admin-broadcast.ts:100-104`  
Two concurrent sends both pass status check before either sets SENDING.

### H4. Password hash leaks via admin APIs
**File:** `backend/src/routes/admin-users.ts:70-135`  
User objects returned without filtering `passwordHash` in several admin endpoints.

### H5. Gift code enumeration (no rate limit)
**File:** `backend/src/routes/gifts.ts:110-122`  
Public `/status/:code` endpoint — no auth, no rate limit. Brute-forceable.

### H6. Bot throttling always returns false
**File:** `backend/src/bot/engine.ts:248-257`  
`isThrottled()` is a stub returning `false`. Users can spam bot blocks.

### H7. Unsigned JWT cookies
**File:** `backend/src/plugins/index.ts:22`  
`signed: false` — cookies can be tampered with client-side.

### H8. Missing security headers in nginx
**File:** `nginx/nginx.conf`  
No Content-Security-Policy, Referrer-Policy, Permissions-Policy.

### H9. No resource limits in Docker
**File:** `docker-compose.yml`  
No CPU/memory caps on any container. OOM risk.

### H10. Unbounded queries in analytics
**File:** `backend/src/routes/admin-analytics.ts:27-31`  
No `.take()` limit. Could fetch millions of rows into memory.

### H11. No referral fraud prevention
**File:** `backend/src/routes/users.ts:300-329`  
Checks for ANY payment, not PAID. Can apply referral after expired pending payment.

### H12. Dashboard Promise.all without error handling
**File:** `frontend/src/app/dashboard/page.tsx:116-127`  
If any fetch fails, entire dashboard breaks silently. No error state.

---

## MEDIUM (fix during development)

### M1. 11 files with @ts-nocheck
**Files:** payments.ts, public.ts, webhooks.ts, gifts.ts, users.ts, news.ts, instructions.ts, admin-import.ts, admin-import-excel.ts, admin-landing.ts, admin-data-import.ts  
TypeScript checking disabled entirely. Masks type errors.

### M2. No role-based access control
All admin routes use `adminOnly` but don't distinguish EDITOR/ADMIN/INVESTOR roles.

### M3. Debug console.logs in production code
**File:** `backend/src/routes/admin-import-excel.ts:275-276`

### M4. Multiple silent catch blocks
**Files:** admin.ts, auth.ts, admin-data-import.ts, admin-landing.ts, funnel-engine.ts  
Errors silently swallowed, impossible to debug.

### M5. Missing audit logging
Admin endpoints modify users/payments/settings but don't log who changed what.

### M6. Inconsistent pagination
Some endpoints cap limits (max 100), others allow unbounded. Inconsistent patterns.

### M7. Fire-and-forget DB updates
**Files:** users.ts:33, admin-landing.ts:46, admin-data-import.ts:289  
Promises not awaited — data loss on crash.

### M8. Missing cascade deletes in Prisma schema
20+ foreign keys missing `onDelete: Cascade` or `onDelete: SetNull`.

### M9. UtmClick/UtmLead use utmCode string FK instead of campaignId
**File:** `backend/prisma/schema.prisma`  
String-based FK — if utmCode changes, orphaned records.

### M10. Missing indexes on frequently queried fields
tariffId on Payment, referrerId on ReferralBonus, promoId on PromoUsage.

### M11. Incomplete notification implementation
**File:** `backend/src/services/notifications.ts`  
`giftClaimed()` is a stub — gift senders never notified.

### M12. No abort controllers in frontend fetches
**File:** `frontend/src/app/dashboard/layout.tsx:49-79`  
State updates on unmounted components.

### M13. Hardcoded Moscow timezone
**File:** `backend/src/bot/engine.ts:286-302`  
`const moscowOffset = 3 * 60` — breaks during DST, only works for Moscow.

### M14. Weak verification code entropy
**File:** `backend/src/services/verification.ts:31-32`  
`Math.random()` not cryptographically secure. Use `crypto.getRandomValues()`.

### M15. Missing form validation in frontend
**File:** `frontend/src/app/setup/page.tsx:60-79`  
Empty strings, invalid URLs accepted without validation.

### M16. Inconsistent API error handling in frontend
`lib/api.ts` uses `any` types, `lib/api-user.ts` uses typed responses.

### M17. Instruction image upload returns 501
**File:** `backend/src/routes/instructions.ts:134`  
Endpoint exists but returns "Not Implemented".

### M18. No duplicate prevention on webhook user creation
**File:** `backend/src/routes/admin-payments.ts:158-172`  
Race condition — double webhook = duplicate user.

### M19. Missing accessibility (a11y)
Modals without aria-modal, buttons without labels, no focus traps.

### M20. Frontend hardcoded API wrappers instead of centralized client
**File:** `frontend/src/app/admin/users/page.tsx:8-9`  
Duplicated `apiFetch` instead of using shared `adminApi`.

---

## LOW (nice to have)

### L1. Hardcoded rate limit values (plugins/index.ts)
### L2. Missing .env.example file
### L3. Missing test scripts in package.json
### L4. No test infrastructure (no vitest/jest configured)
### L5. Unused imports in various frontend files
### L6. Inconsistent loading skeletons across pages
### L7. All UI text hardcoded in Russian (no i18n)
### L8. Dockerfile layer caching suboptimal
### L9. Legacy --legacy-peer-deps in npm install
### L10. Missing npm audit in Docker build

---

## PRIORITY ORDER FOR FIXES

### Phase 1 — Critical bugs (break core functionality)
1. C1 — Fix payment status field
2. C2 — Implement payment verification
3. C3 — Add missing email service methods
4. C4, C5 — Fix gift service remnawave calls
5. C6, C7 — Add transactions for race conditions
6. C9 — Fix XSS in instructions page
7. C10 — Add auth guards to middleware

### Phase 2 — Security hardening
8. C8 — Rotate secrets, add .env.example
9. H4 — Filter passwordHash from all responses
10. H5 — Rate limit gift code endpoint
11. H7 — Sign JWT cookies
12. H8 — Add nginx security headers

### Phase 3 — Performance & reliability
13. H1 — Fix N+1 queries
14. H2 — Batch broadcast sending
15. H3, H6 — Fix race conditions & implement throttling
16. H10 — Add query limits
17. H12 — Add error handling to frontend

### Phase 4 — Code quality
18. M1 — Remove @ts-nocheck, add proper types
19. M2 — Implement RBAC
20. M3, M4 — Clean debug logs & silent catches
21. M5 — Add audit logging
22. M6-M20 — Remaining medium issues

### Phase 5 — Polish
23. L1-L10 — Low priority improvements
