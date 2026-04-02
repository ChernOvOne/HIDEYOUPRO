import nodemailer from 'nodemailer'
import { config } from '../config'
import { prisma } from '../db'
import { logger } from '../utils/logger'

// ── Email Templates ─────────────────────────────────────────
const EMAIL_TEMPLATES: Record<string, (content: string, appUrl: string) => string> = {
  dark: (content, appUrl) => `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><style>
  body { font-family: -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; }
  .container { max-width: 520px; margin: 40px auto; background: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid #334155; }
  h2 { color: #f1f5f9; margin-top: 0; }
  p { color: #94a3b8; line-height: 1.6; }
  .btn { display: inline-block; background: #5569ff; color: #fff !important; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; margin-top: 16px; }
  .footer { text-align: center; margin-top: 32px; color: #475569; font-size: 12px; }
</style></head><body>
  <div class="container">${content}<div class="footer"><p>HIDEYOU VPN · <a href="${appUrl}" style="color:#5569ff">${appUrl}</a></p></div></div>
</body></html>`,

  gradient: (content, appUrl) => `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><style>
  body { font-family: -apple-system, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%); }
  .container { max-width: 520px; margin: 40px auto; background: rgba(30,41,59,0.9); border-radius: 20px; padding: 40px; border: 1px solid rgba(139,92,246,0.2); }
  h2 { color: #f1f5f9; margin-top: 0; background: linear-gradient(135deg, #a78bfa, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  p { color: #94a3b8; line-height: 1.7; }
  .btn { display: inline-block; background: linear-gradient(135deg, #8b5cf6, #06b6d4); color: #fff !important; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; margin-top: 16px; }
  .footer { text-align: center; margin-top: 32px; color: #475569; font-size: 12px; }
</style></head><body>
  <div class="container">${content}<div class="footer"><p>HIDEYOU VPN · <a href="${appUrl}" style="color:#a78bfa">${appUrl}</a></p></div></div>
</body></html>`,

  minimal: (content, appUrl) => `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><style>
  body { font-family: -apple-system, sans-serif; margin: 0; padding: 0; background: #f8fafc; }
  .container { max-width: 520px; margin: 40px auto; background: #ffffff; border-radius: 12px; padding: 40px; border: 1px solid #e2e8f0; }
  h2 { color: #1e293b; margin-top: 0; }
  p { color: #64748b; line-height: 1.6; }
  .btn { display: inline-block; background: #3b82f6; color: #fff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
  .footer { text-align: center; margin-top: 32px; color: #94a3b8; font-size: 12px; }
</style></head><body>
  <div class="container">${content}<div class="footer"><p>HIDEYOU VPN · <a href="${appUrl}" style="color:#3b82f6">${appUrl}</a></p></div></div>
</body></html>`,
}

export const EMAIL_TEMPLATE_NAMES = Object.keys(EMAIL_TEMPLATES)

// ── Service ─────────────────────────────────────────────────
let transporter: nodemailer.Transporter | null = null
let enabled = false
let fromAddress = ''
let dbChecked = false

async function ensureTransporter(): Promise<boolean> {
  if (enabled && transporter) return true
  if (dbChecked) return false

  // Try env config first
  let host = config.smtp.host
  let port = config.smtp.port
  let user = config.smtp.user
  let pass = config.smtp.pass
  let from = config.smtp.from

  // Fallback to DB settings
  if (!host || !user) {
    dbChecked = true
    try {
      const rows = await prisma.setting.findMany({
        where: { key: { in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from'] } },
      })
      const s: Record<string, string> = {}
      for (const r of rows) s[r.key] = r.value
      if (s.smtp_host && s.smtp_user && s.smtp_pass) {
        host = s.smtp_host
        port = Number(s.smtp_port || 587)
        user = s.smtp_user
        pass = s.smtp_pass
        from = s.smtp_from || s.smtp_user
        logger.info(`Email configured from DB: ${host}`)
      }
    } catch {}
  }

  if (!host || !user || !pass) {
    logger.warn('Email: SMTP not configured')
    return false
  }

  transporter = nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: { user, pass },
  })
  fromAddress = from || user
  enabled = true
  return true
}

function wrap(content: string, template?: string): string {
  const tpl = EMAIL_TEMPLATES[template || 'dark'] || EMAIL_TEMPLATES.dark
  return tpl(content, config.appUrl)
}

async function getTemplate(key: string, vars: Record<string, string>, fallback: string): Promise<string> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: `email_tpl_${key}` } })
    if (setting?.value) {
      let html = setting.value
      for (const [k, v] of Object.entries(vars)) {
        html = html.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
      }
      return html
    }
  } catch {}
  return fallback
}

export const emailService = {
  /** Force reload SMTP settings (call after admin changes) */
  async reload() {
    dbChecked = false
    enabled = false
    transporter = null
    await ensureTransporter()
  },

  /** Core send method */
  async send(to: string, subject: string, html: string): Promise<boolean> {
    await ensureTransporter()
    if (!enabled || !transporter) {
      logger.warn(`Email skipped (SMTP not configured): ${to} — ${subject}`)
      return false
    }
    try {
      const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      await transporter.sendMail({
        from:    `HIDEYOU VPN <${fromAddress}>`,
        replyTo: fromAddress,
        to, subject, html, text,
        headers: {
          'X-Mailer': 'HIDEYOU PRO',
          'List-Unsubscribe': `<mailto:${fromAddress}?subject=unsubscribe>`,
        },
      })
      logger.info(`Email sent: ${to} — ${subject}`)
      return true
    } catch (err) {
      logger.error('Email send failed:', err)
      return false
    }
  },

  // ── Template emails ────────────────────────────────────────

  async sendWelcome(email: string) {
    const content = await getTemplate('welcome', { appUrl: config.appUrl }, `
      <h2>Добро пожаловать!</h2>
      <p>Твой аккаунт в <strong>HIDEYOU VPN</strong> создан.</p>
      <p>Войди в личный кабинет чтобы выбрать тариф:</p>
      <a href="${config.appUrl}/dashboard" class="btn">Открыть личный кабинет</a>
    `)
    return this.send(email, 'Добро пожаловать в HIDEYOU VPN', wrap(content))
  },

  async sendPaymentSuccess(email: string, tariffName: string, expireAt: Date) {
    const expireStr = expireAt.toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })
    const content = await getTemplate('payment', { tariffName, expireAt: expireStr, appUrl: config.appUrl }, `
      <h2>Оплата подтверждена!</h2>
      <p>Тариф: <strong>${tariffName}</strong></p>
      <p>Подписка активна до: <strong>${expireStr}</strong></p>
      <a href="${config.appUrl}/dashboard" class="btn">Открыть кабинет</a>
    `)
    return this.send(email, '✅ Оплата прошла — HIDEYOU VPN', wrap(content))
  },

  async sendExpiryWarning(email: string, daysLeft: number) {
    const content = await getTemplate('expiry', { daysLeft: String(daysLeft), appUrl: config.appUrl }, `
      <h2>Подписка заканчивается</h2>
      <p>Ваша подписка истекает через <strong>${daysLeft} дней</strong>.</p>
      <p>Продлите сейчас чтобы не потерять доступ:</p>
      <a href="${config.appUrl}/dashboard" class="btn">Продлить подписку</a>
    `)
    return this.send(email, `⚠️ Подписка истекает через ${daysLeft} дней — HIDEYOU VPN`, wrap(content))
  },

  async sendVerificationCode(to: string, code: string, subject?: string) {
    const content = await getTemplate('verification', { code }, `
      <h2>Код подтверждения</h2>
      <p>Ваш код:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px;background:rgba(85,105,255,0.15);border-radius:12px;color:#f1f5f9">${code}</div>
      <p style="margin-top:16px">Код действителен 10 минут. Не сообщайте его никому.</p>
    `)
    return this.send(to, subject || 'Код подтверждения — HIDEYOU VPN', wrap(content))
  },

  async sendGiftNotification(to: string, giftCode: string, tariffName: string, senderName: string) {
    const content = await getTemplate('gift', { senderName, tariffName, giftCode, appUrl: config.appUrl }, `
      <h2>Вам подарок!</h2>
      <p><strong>${senderName}</strong> подарил вам подписку <strong>${tariffName}</strong>.</p>
      <a href="${config.appUrl}/present/${giftCode}" class="btn">Активировать подарок</a>
      <p style="margin-top:16px;font-size:13px;color:#64748b">Код: <strong>${giftCode}</strong></p>
    `)
    return this.send(to, '🎁 Вам подарили VPN-подписку — HIDEYOU', wrap(content))
  },

  async sendPasswordReset(email: string, code: string) {
    const content = await getTemplate('reset', { code }, `
      <h2>Сброс пароля</h2>
      <p>Код для сброса пароля:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px;background:rgba(85,105,255,0.15);border-radius:12px;color:#f1f5f9">${code}</div>
      <p style="margin-top:16px">Если вы не запрашивали сброс, проигнорируйте это письмо.</p>
    `)
    return this.send(email, 'Сброс пароля — HIDEYOU VPN', wrap(content))
  },

  async sendTrialOffer(email: string, trialDays: number) {
    const content = await getTemplate('trial_offer', { trialDays: String(trialDays), appUrl: config.appUrl }, `
      <h2>🎁 Попробуйте бесплатно!</h2>
      <p>Специально для вас — <strong>бесплатный пробный период на ${trialDays} дней</strong>!</p>
      <a href="${config.appUrl}/dashboard" class="btn">Активировать пробный период</a>
      <p style="margin-top:20px;font-size:13px;color:#64748b">Полный доступ без ограничений. Никаких обязательств.</p>
    `)
    return this.send(email, `🎁 ${trialDays} дней бесплатного VPN — HIDEYOU`, wrap(content))
  },

  async sendBroadcastEmail(params: {
    to: string; subject: string; html: string;
    btnText?: string; btnUrl?: string; template?: string;
  }) {
    let content = params.html
    if (params.btnText && params.btnUrl) {
      content += `\n<a href="${params.btnUrl}" class="btn">${params.btnText}</a>`
    }
    return this.send(params.to, params.subject, wrap(content, params.template))
  },
}
