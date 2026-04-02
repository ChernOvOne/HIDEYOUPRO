import { nanoid }    from 'nanoid'
import { prisma }    from '../db'
import { config }    from '../config'
import { logger }    from '../utils/logger'
import { remnawave } from './remnawave'
import { notifications } from './notifications'

class GiftService {
  /**
   * Create a gift subscription (after payment is confirmed)
   */
  async createGift(params: {
    fromUserId:     string
    tariffId:       string
    paymentId:      string
    recipientEmail?: string
    message?:       string
  }) {
    const giftCode = 'present_' + nanoid(10)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + config.gifts.codeExpiryDays)

    const gift = await prisma.giftSubscription.create({
      data: {
        code:       giftCode,
        senderId:   params.fromUserId,
        tariffId:   params.tariffId,
        message:    params.message,
        status:     'PENDING',
        expiresAt,
      },
    })

    // Get tariff and sender for email
    const [tariff, sender] = await Promise.all([
      prisma.tariff.findUnique({ where: { id: params.tariffId } }),
      prisma.user.findUnique({ where: { id: params.fromUserId }, select: { telegramName: true, email: true } }),
    ])

    // Send email to recipient if specified
    if (params.recipientEmail && tariff) {
      const { emailService } = await import('./email')
      await emailService.sendGiftNotification(
        params.recipientEmail,
        giftCode,
        tariff.name,
        sender?.telegramName || sender?.email || 'Друг',
      ).catch((err: any) => logger.warn('Gift email notification failed:', err))
    }

    logger.info(`Gift created: ${giftCode} by user ${params.fromUserId}`)
    return { ...gift, tariffName: tariff?.name }
  }

  /**
   * Get gift status by code (public)
   */
  async getGiftStatus(code: string) {
    const gift = await prisma.giftSubscription.findUnique({
      where: { code },
    })

    if (!gift) return null

    // Get related data
    const [tariff, sender] = await Promise.all([
      prisma.tariff.findUnique({ where: { id: gift.tariffId }, select: { name: true, durationDays: true } }),
      prisma.user.findUnique({ where: { id: gift.senderId }, select: { telegramName: true, email: true } }),
    ])

    // Check if expired
    if (gift.status === 'PENDING' && gift.expiresAt < new Date()) {
      await prisma.giftSubscription.update({
        where: { id: gift.id },
        data:  { status: 'EXPIRED' },
      })
      return { ...gift, status: 'EXPIRED' as const, tariff, sender }
    }

    return { ...gift, tariff, sender }
  }

  /**
   * Claim a gift subscription
   */
  async claimGift(code: string, userId: string) {
    const gift = await prisma.giftSubscription.findUnique({
      where: { code },
    })

    if (!gift) throw new Error('Подарок не найден')
    if (gift.status !== 'PENDING') throw new Error('Подарок уже использован или истёк')
    if (gift.expiresAt < new Date()) {
      await prisma.giftSubscription.update({
        where: { id: gift.id },
        data:  { status: 'EXPIRED' },
      })
      throw new Error('Срок действия подарка истёк')
    }

    // Atomic update — only claim if still PENDING (prevents race condition)
    const claimed = await prisma.giftSubscription.updateMany({
      where: { id: gift.id, status: 'PENDING' },
      data: {
        recipientId: userId,
        status:      'CLAIMED',
        claimedAt:   new Date(),
      },
    })
    if (claimed.count === 0) throw new Error('Подарок уже использован')

    // Activate subscription for recipient
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new Error('User not found')

    const tariff = await prisma.tariff.findUnique({ where: { id: gift.tariffId } })
    if (!tariff) throw new Error('Tariff not found')

    if (!user.remnawaveUuid) {
      // Create REMNAWAVE user
      const trafficLimitBytes = tariff.trafficGb ? tariff.trafficGb * 1024 * 1024 * 1024 : 0
      const rmUser = await remnawave.createUser({
        username:             user.email ? user.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '_') : user.telegramId ? `tg_${user.telegramId}` : `user_${user.id.slice(0, 8)}`,
        email:                user.email ?? undefined,
        telegramId:           user.telegramId ? parseInt(user.telegramId, 10) : null,
        expireAt:             new Date(Date.now() + tariff.durationDays * 86400_000).toISOString(),
        trafficLimitBytes,
        trafficLimitStrategy: tariff.trafficStrategy || 'MONTH',
        hwidDeviceLimit:      tariff.deviceLimit ?? 3,
        tag:                  tariff.remnawaveTag ?? undefined,
        activeInternalSquads: tariff.remnawaveSquads.length > 0 ? tariff.remnawaveSquads : undefined,
      })

      await prisma.user.update({
        where: { id: userId },
        data: {
          remnawaveUuid: rmUser.uuid,
          subLink:       remnawave.getSubscriptionUrl(rmUser.uuid),
          subStatus:     'ACTIVE',
          subExpireAt:   new Date(Date.now() + tariff.durationDays * 86400_000),
        },
      })
    } else {
      // Extend existing subscription
      await remnawave.extendSubscription(user.remnawaveUuid, tariff.durationDays)

      const newExpireAt = new Date()
      if (user.subExpireAt && user.subExpireAt > newExpireAt) {
        newExpireAt.setTime(user.subExpireAt.getTime())
      }
      newExpireAt.setDate(newExpireAt.getDate() + tariff.durationDays)

      await prisma.user.update({
        where: { id: userId },
        data:  { subStatus: 'ACTIVE', subExpireAt: newExpireAt },
      })
    }

    // Create payment record for recipient (gift)
    await prisma.payment.create({
      data: {
        userId,
        tariffId:    gift.tariffId,
        provider:    'MANUAL',
        amount:      0,
        currency:    'RUB',
        status:      'PAID',
        purpose:     'GIFT',
        paidAt:      new Date(),
        metadata: {
          _giftClaim: true,
          giftCode:   code,
          senderId:   gift.senderId,
        },
      },
    })

    logger.info(`Gift ${code} claimed by user ${userId}`)

    // Notify gift sender
    await notifications.giftClaimed(gift.senderId, userId, tariff.name).catch((err: any) =>
      logger.warn('Gift claim notification failed:', err)
    )

    return { tariffName: tariff.name, durationDays: tariff.durationDays }
  }

  /**
   * Get gifts sent by user
   */
  async getUserGifts(userId: string) {
    const gifts = await prisma.giftSubscription.findMany({
      where:   { senderId: userId },
      orderBy: { createdAt: 'desc' },
    })

    // Enrich with tariff names
    const tariffIds = [...new Set(gifts.map(g => g.tariffId))]
    const tariffs = await prisma.tariff.findMany({
      where: { id: { in: tariffIds } },
      select: { id: true, name: true, durationDays: true },
    })
    const tariffMap = new Map(tariffs.map(t => [t.id, t]))

    return gifts.map(g => ({
      ...g,
      tariff: tariffMap.get(g.tariffId) || null,
    }))
  }

  /**
   * Expire stale gifts (cron job)
   */
  async expireStaleGifts(): Promise<number> {
    const result = await prisma.giftSubscription.updateMany({
      where: {
        status:    'PENDING',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    })
    if (result.count > 0) {
      logger.info(`Expired ${result.count} stale gift subscriptions`)
    }
    return result.count
  }
}

export const giftService = new GiftService()
