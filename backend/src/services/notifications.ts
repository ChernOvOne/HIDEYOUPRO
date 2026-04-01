import { logger } from '../utils/logger'

export const notifications = {
  async giftClaimed(fromUserId: string, toUserId: string, tariffName: string) {
    logger.info(`Gift claimed: ${tariffName} from ${fromUserId} to ${toUserId}`)
    // TODO: send TG notification to fromUser
  },

  async paymentConfirmed(userId: string, amount: number, tariffName: string) {
    logger.info(`Payment confirmed: ${amount} for ${tariffName} by ${userId}`)
  },

  async subscriptionExpiring(userId: string, daysLeft: number) {
    logger.info(`Subscription expiring in ${daysLeft} days for ${userId}`)
  },
}
