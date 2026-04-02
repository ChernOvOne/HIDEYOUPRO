import nodemailer from 'nodemailer'
import { config } from '../config'
import { prisma } from '../db'
import { logger } from '../utils/logger'

let transporter: nodemailer.Transporter | null = null

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  if (transporter) return transporter

  // Try env config first
  let host = config.smtp.host
  let port = config.smtp.port
  let user = config.smtp.user
  let pass = config.smtp.pass
  let from = config.smtp.from

  // Fallback to DB settings
  if (!host || !user) {
    try {
      const [h, p, u, pw, f] = await Promise.all([
        prisma.setting.findUnique({ where: { key: 'smtp_host' } }),
        prisma.setting.findUnique({ where: { key: 'smtp_port' } }),
        prisma.setting.findUnique({ where: { key: 'smtp_user' } }),
        prisma.setting.findUnique({ where: { key: 'smtp_pass' } }),
        prisma.setting.findUnique({ where: { key: 'smtp_from' } }),
      ])
      if (h?.value) host = h.value
      if (p?.value) port = parseInt(p.value, 10)
      if (u?.value) user = u.value
      if (pw?.value) pass = pw.value
      if (f?.value) from = f.value
    } catch {}
  }

  if (!host || !user || !pass) {
    logger.warn('Email: SMTP not configured')
    return null
  }

  transporter = nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: { user, pass },
  })

  return transporter
}

export const emailService = {
  async send(to: string, subject: string, html: string) {
    const t = await getTransporter()
    if (!t) throw new Error('SMTP not configured')
    const from = config.smtp.from
    await t.sendMail({ from, to, subject, html })
    logger.info(`Email sent to ${to}: ${subject}`)
  },

  async sendVerificationCode(to: string, code: string, subject: string) {
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#534AB7">HIDEYOU VPN</h2>
        <p>${subject}</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:24px;background:#f4f4f5;border-radius:12px;margin:16px 0">${code}</div>
        <p style="color:#888;font-size:13px">Код действителен 10 минут. Если вы не запрашивали этот код, просто проигнорируйте это письмо.</p>
      </div>
    `
    await this.send(to, subject, html)
  },

  async sendGiftNotification(to: string, giftCode: string, tariffName: string, fromName: string) {
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#534AB7">🎁 Вам подарок!</h2>
        <p><strong>${fromName}</strong> подарил вам подписку <strong>${tariffName}</strong> на HIDEYOU VPN.</p>
        <p>Ваш код активации:</p>
        <div style="font-size:20px;font-weight:700;text-align:center;padding:16px;background:#f4f4f5;border-radius:12px;margin:16px 0;word-break:break-all">${giftCode}</div>
        <p style="color:#888;font-size:13px">Активируйте подарок в личном кабинете или через Telegram-бот.</p>
      </div>
    `
    await this.send(to, `🎁 Подарок от ${fromName} — HIDEYOU VPN`, html)
  },

  async sendBroadcastEmail(params: { to: string; subject: string; html: string; btnText?: string; btnUrl?: string; template?: string }) {
    const t = await getTransporter()
    if (!t) throw new Error('SMTP not configured')

    let html = params.html
    if (params.btnText && params.btnUrl) {
      html += `<br><a href="${params.btnUrl}" style="display:inline-block;padding:12px 24px;background:#534AB7;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">${params.btnText}</a>`
    }

    // Auto-generate plain text
    const text = html.replace(/<[^>]*>/g, '').trim()

    await t.sendMail({
      from: config.smtp.from,
      to: params.to,
      subject: params.subject,
      html,
      text,
      headers: {
        'X-Mailer': 'HIDEYOU PRO',
        'List-Unsubscribe': `<mailto:${config.smtp.from}?subject=unsubscribe>`,
      },
    })
  },
}
