import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV:              z.enum(['development', 'production', 'test']).default('production'),
  PORT:                  z.coerce.number().default(4000),
  DOMAIN:                z.string().default('localhost'),
  APP_URL:               z.string().default('http://localhost:3000'),
  JWT_SECRET:            z.string().min(32),
  JWT_EXPIRES_IN:        z.string().default('30d'),
  COOKIE_SECRET:         z.string().optional(),

  DATABASE_URL:          z.string(),
  REDIS_URL:             z.string(),

  REMNAWAVE_URL:         z.string().default(''),
  REMNAWAVE_TOKEN:       z.string().optional().default(''),

  TELEGRAM_BOT_TOKEN:    z.string().optional().default(''),
  TELEGRAM_BOT_NAME:     z.string().optional().default(''),
  TELEGRAM_LOGIN_BOT_TOKEN: z.string().optional(),

  YUKASSA_SHOP_ID:       z.string().optional(),
  YUKASSA_SECRET_KEY:    z.string().optional(),
  YUKASSA_RETURN_URL:    z.string().optional(),
  YUKASSA_WEBHOOK_SECRET: z.string().optional(),

  CRYPTOPAY_API_TOKEN:   z.string().optional(),
  CRYPTOPAY_NETWORK:     z.enum(['mainnet', 'testnet']).default('mainnet'),

  REFERRAL_BONUS_DAYS:   z.coerce.number().default(30),
  REFERRAL_MIN_DAYS:     z.coerce.number().default(30),
  REFERRAL_REWARD_TYPE:  z.enum(['days', 'balance', 'both']).default('days'),
  REFERRAL_REWARD_AMOUNT: z.coerce.number().default(100),

  SMTP_HOST:             z.string().optional(),
  SMTP_PORT:             z.coerce.number().default(587),
  SMTP_USER:             z.string().optional(),
  SMTP_PASS:             z.string().optional(),
  SMTP_FROM:             z.string().optional(),

  FEATURE_CRYPTO_PAYMENTS: z.coerce.boolean().default(true),
  FEATURE_REFERRAL:        z.coerce.boolean().default(true),
  FEATURE_EMAIL_AUTH:      z.coerce.boolean().default(true),
  FEATURE_TELEGRAM_AUTH:   z.coerce.boolean().default(true),
  FEATURE_TRIAL:           z.coerce.boolean().default(false),
  TRIAL_DAYS:              z.coerce.number().default(3),
  FEATURE_GIFTS:           z.coerce.boolean().default(true),
  FEATURE_BALANCE:         z.coerce.boolean().default(true),

  GIFT_CODE_EXPIRY_DAYS:   z.coerce.number().default(30),
  VERIFICATION_CODE_TTL:   z.coerce.number().default(600),
  LOG_LEVEL:             z.string().default('info'),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

const env = parsed.data

// ── DB Settings cache (loaded once at startup, refreshed periodically) ──
let dbSettings: Record<string, string> = {}
let dbLoaded = false

/** Load settings from DB. Called on startup and every 5 min. */
export async function loadDbSettings() {
  try {
    const { prisma } = await import('./db')
    const rows = await prisma.setting.findMany()
    dbSettings = Object.fromEntries(rows.map(r => [r.key, r.value]))
    dbLoaded = true
  } catch {
    // DB may not be ready yet at first import
  }
}

/** Get setting: env var wins, then DB, then fallback */
function get(envVal: string | undefined | null, dbKey: string, fallback = ''): string {
  if (envVal) return envVal
  if (dbSettings[dbKey]) return dbSettings[dbKey]
  return fallback
}

// ── Exported config (reads from env + DB dynamically) ──
export const config = {
  nodeEnv:    env.NODE_ENV,
  isDev:      env.NODE_ENV === 'development',
  isProd:     env.NODE_ENV === 'production',
  port:       env.PORT,
  domain:     env.DOMAIN,
  appUrl:     env.APP_URL,
  jwtSecret:  env.JWT_SECRET,
  jwtExpires: env.JWT_EXPIRES_IN,
  cookieSecret: env.COOKIE_SECRET || env.JWT_SECRET,
  cookieDomain: (() => {
    const d = env.DOMAIN
    if (!d || d === 'localhost' || d.startsWith('127.') || d.startsWith('192.168.')) return undefined
    const parts = d.split('.')
    return `.${parts.slice(-2).join('.')}`
  })(),

  db:    { url: env.DATABASE_URL },
  redis: { url: env.REDIS_URL },

  get remnawave() {
    const url   = get(env.REMNAWAVE_URL, 'remnawave_url')
    const token = get(env.REMNAWAVE_TOKEN, 'remnawave_token')
    return { url, token, configured: !!(token && url) }
  },

  get telegram() {
    const botToken = get(env.TELEGRAM_BOT_TOKEN, 'bot_token')
    const botName  = get(env.TELEGRAM_BOT_NAME, 'bot_name')
    return {
      botToken, botName,
      loginBotToken: env.TELEGRAM_LOGIN_BOT_TOKEN || botToken,
      configured: !!botToken,
    }
  },

  get yukassa() {
    const shopId    = get(env.YUKASSA_SHOP_ID, 'yukassa_shop_id')
    const secretKey = get(env.YUKASSA_SECRET_KEY, 'yukassa_secret_key')
    return {
      shopId, secretKey,
      returnUrl:     env.YUKASSA_RETURN_URL || dbSettings.yukassa_return_url || `${env.APP_URL}/dashboard/payment-success`,
      webhookSecret: env.YUKASSA_WEBHOOK_SECRET,
      enabled:       !!(shopId && secretKey),
    }
  },

  get cryptopay() {
    const apiToken = get(env.CRYPTOPAY_API_TOKEN, 'cryptopay_token')
    return {
      apiToken,
      network: env.CRYPTOPAY_NETWORK,
      enabled: !!apiToken && env.FEATURE_CRYPTO_PAYMENTS,
    }
  },

  get referral() {
    return {
      bonusDays:    Number(get(String(env.REFERRAL_BONUS_DAYS), 'referral_bonus_days', '30')),
      minDays:      Number(get(String(env.REFERRAL_MIN_DAYS), 'referral_min_days', '30')),
      enabled:      get(String(env.FEATURE_REFERRAL), 'referral_enabled', 'true') === 'true',
      rewardType:   env.REFERRAL_REWARD_TYPE,
      rewardAmount: env.REFERRAL_REWARD_AMOUNT,
    }
  },

  get smtp() {
    const host = get(env.SMTP_HOST, 'smtp_host')
    const user = get(env.SMTP_USER, 'smtp_user')
    const pass = get(env.SMTP_PASS, 'smtp_pass')
    return {
      host,
      port: Number(get(String(env.SMTP_PORT), 'smtp_port', '587')),
      user, pass,
      from: get(env.SMTP_FROM, 'smtp_from', `noreply@${env.DOMAIN}`),
      configured: !!(host && user && pass),
    }
  },

  features: {
    cryptoPayments: env.FEATURE_CRYPTO_PAYMENTS,
    referral:       env.FEATURE_REFERRAL,
    emailAuth:      env.FEATURE_EMAIL_AUTH,
    telegramAuth:   env.FEATURE_TELEGRAM_AUTH,
    trial:          env.FEATURE_TRIAL,
    trialDays:      env.TRIAL_DAYS,
    gifts:          env.FEATURE_GIFTS,
    balance:        env.FEATURE_BALANCE,
  },

  gifts:        { codeExpiryDays: env.GIFT_CODE_EXPIRY_DAYS },
  verification: { codeTtl: env.VERIFICATION_CODE_TTL },
  logLevel:     env.LOG_LEVEL,
}
