import { prisma }  from '../db'
import { logger }  from '../utils/logger'
import type { NotificationType } from '@prisma/client'

class InAppNotificationService {
  /** Send notification to a specific user (bell icon + TG) */
  async sendToUser(params: {
    userId:  string
    title:   string
    message: string
    type?:   string
    url?:    string
  }) {
    const notification = await prisma.notification.create({
      data: {
        userId:  params.userId,
        title:   params.title,
        message: params.message,
        type:    (params.type || 'INFO') as NotificationType,
        url:     params.url,
      },
    })

    // Also try to send via Telegram
    try {
      const user = await prisma.user.findUnique({
        where:  { id: params.userId },
        select: { telegramId: true },
      })
      if (user?.telegramId) {
        const { bot } = await import('../bot/index')
        await bot.api.sendMessage(user.telegramId, `${params.title}\n\n${params.message}`)
      }
    } catch (err) {
      logger.debug('TG notification failed:', err)
    }

    return notification
  }

  /** Send broadcast notification to all active users */
  async sendBroadcast(params: {
    title:   string
    message: string
    type?:   string
    url?:    string
  }) {
    const users = await prisma.user.findMany({
      where:  { isActive: true },
      select: { id: true },
    })
    if (users.length === 0) return 0

    const result = await prisma.notification.createMany({
      data: users.map(u => ({
        userId:  u.id,
        title:   params.title,
        message: params.message,
        type:    (params.type || 'INFO') as NotificationType,
        url:     params.url,
      })),
    })
    logger.info(`Broadcast notification sent to ${result.count} users`)
    return result.count
  }

  /** Send notification to multiple specific users */
  async sendToUsers(params: {
    userIds: string[]
    title:   string
    message: string
    type?:   string
    url?:    string
  }) {
    const result = await prisma.notification.createMany({
      data: params.userIds.map(userId => ({
        userId,
        title:   params.title,
        message: params.message,
        type:    (params.type || 'INFO') as NotificationType,
        url:     params.url,
      })),
    })
    logger.info(`Sent ${result.count} notifications`)
    return result.count
  }

  /** Get notifications for a user with pagination */
  async getUserNotifications(userId: string, opts: {
    page?:      number
    limit?:     number
    unreadOnly?: boolean
  } = {}) {
    const { page = 1, limit = 20, unreadOnly = false } = opts
    const skip = (page - 1) * limit

    const where: any = { userId }
    if (unreadOnly) {
      where.reads = { none: { userId } }
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          reads: { where: { userId }, select: { readAt: true } },
        },
      }),
      prisma.notification.count({ where }),
    ])

    return {
      notifications: notifications.map(n => ({
        id:        n.id,
        title:     n.title,
        message:   n.message,
        type:      n.type,
        url:       n.url,
        isRead:    n.reads.length > 0,
        createdAt: n.createdAt,
      })),
      total,
    }
  }

  /** Get unread count for user */
  async getUnreadCount(userId: string): Promise<number> {
    const total = await prisma.notification.count({ where: { userId } })
    const read  = await prisma.notificationRead.count({ where: { userId } })
    return Math.max(0, total - read)
  }

  /** Mark a single notification as read */
  async markAsRead(notificationId: string, userId: string) {
    await prisma.notificationRead.upsert({
      where: { userId_notificationId: { notificationId, userId } },
      create: { notificationId, userId },
      update: {},
    })
  }

  /** Mark all notifications as read for a user */
  async markAllAsRead(userId: string): Promise<number> {
    const unread = await prisma.notification.findMany({
      where: { userId, reads: { none: { userId } } },
      select: { id: true },
    })

    if (unread.length > 0) {
      await prisma.notificationRead.createMany({
        data:           unread.map(n => ({ notificationId: n.id, userId })),
        skipDuplicates: true,
      })
    }
    return unread.length
  }
}

export const inAppNotifications = new InAppNotificationService()
