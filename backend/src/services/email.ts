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
