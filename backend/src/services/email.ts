import { logger } from '../utils/logger'

export const emailService = {
  async sendBroadcastEmail(params: { to: string; subject: string; html: string; btnText?: string; btnUrl?: string; template?: string }) {
    logger.warn(`Email stub: would send to ${params.to}: ${params.subject}`)
  },
  async send(to: string, subject: string, html: string) {
    logger.warn(`Email stub: would send to ${to}: ${subject}`)
  },
}
