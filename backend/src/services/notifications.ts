import { prisma } from '../db'
import { logger } from '../utils/logger'

async function sendTg(userId: string, text: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramId: true } })
    if (!user?.telegramId) return
    const { bot } = await import('../bot/index')
    await bot.api.sendMessage(user.telegramId, text, { parse_mode: 'Markdown' })
  } catch (err) {
    logger.warn(`TG notification failed for ${userId}:`, err)
  }
}

async function sendEmail(userId: string, fn: (email: string) => Promise<any>) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    if (!user?.email) return
    const { emailService } = await import('./email')
    await fn(user.email)
  } catch (err) {
    logger.warn(`Email notification failed for ${userId}:`, err)
  }
}

export const notifications = {
  async paymentConfirmed(userId: string, tariffName: string, expireAt: Date) {
    logger.info(`Payment confirmed: ${tariffName} for ${userId}`)
    await sendTg(userId, `✅ Оплата за *${tariffName}* подтверждена!\n\nПодписка активна до: *${expireAt.toLocaleDateString('ru')}*`)
    await sendEmail(userId, async (email) => {
      const { emailService } = await import('./email')
      await emailService.sendPaymentSuccess(email, tariffName, expireAt)
    })
  },

  async subscriptionExpiring(userId: string, daysLeft: number) {
    logger.info(`Subscription expiring in ${daysLeft} days for ${userId}`)
    await sendTg(userId, `⏳ Ваша подписка истекает через *${daysLeft}* дн. Продлите, чтобы не потерять доступ.`)
    await sendEmail(userId, async (email) => {
      const { emailService } = await import('./email')
      await emailService.sendExpiryWarning(email, daysLeft)
    })
  },

  async giftClaimed(fromUserId: string, toUserId: string, tariffName: string) {
    logger.info(`Gift claimed: ${tariffName} from ${fromUserId} to ${toUserId}`)
    await sendTg(fromUserId, `🎁 Ваш подарок *${tariffName}* был активирован!`)
  },

  async referralBonus(userId: string, bonusDays: number) {
    logger.info(`Referral bonus: +${bonusDays} days for ${userId}`)
    await sendTg(userId, `🎉 Вам начислено *+${bonusDays} бонусных дней* за реферала!`)
  },

  async referralBonusMoney(userId: string, amount: number) {
    logger.info(`Referral money bonus: +${amount} RUB for ${userId}`)
    await sendTg(userId, `💰 На баланс начислено *+${amount} ₽* за реферала!`)
  },

  async sendCustom(userId: string, title: string, message: string) {
    await sendTg(userId, title ? `*${title}*\n\n${message}` : message)
    await sendEmail(userId, async (email) => {
      const { emailService } = await import('./email')
      await emailService.send(email, title || 'HIDEYOU VPN', `<h2>${title}</h2><p>${message}</p>`)
    })
  },
}
