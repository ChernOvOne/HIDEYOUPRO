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

export const notifications = {
  async giftClaimed(fromUserId: string, toUserId: string, tariffName: string) {
    logger.info(`Gift claimed: ${tariffName} from ${fromUserId} to ${toUserId}`)
    await sendTg(fromUserId, `🎁 Ваш подарок *${tariffName}* был активирован!`)
  },

  async paymentConfirmed(userId: string, amount: number, tariffName: string) {
    logger.info(`Payment confirmed: ${amount} for ${tariffName} by ${userId}`)
    await sendTg(userId, `✅ Оплата *${amount} ₽* за *${tariffName}* подтверждена!`)
  },

  async subscriptionExpiring(userId: string, daysLeft: number) {
    logger.info(`Subscription expiring in ${daysLeft} days for ${userId}`)
    await sendTg(userId, `⏳ Ваша подписка истекает через *${daysLeft}* дн. Продлите, чтобы не потерять доступ.`)
  },
}
