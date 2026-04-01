import { logger } from '../utils/logger'

export const inAppNotifications = {
  async sendToUser(params: { userId: string; title: string; message: string; type?: string }) {
    const { prisma } = await import('../db')
    await prisma.notification.create({
      data: {
        userId:  params.userId,
        title:   params.title,
        message: params.message,
        type:    (params.type as any) || 'INFO',
      },
    })
  },
}
