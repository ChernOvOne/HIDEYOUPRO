import { prisma } from '../db'
import { remnawave } from '../services/remnawave'
import { logger } from '../utils/logger'

export async function syncSubscriptions() {
  if (!remnawave.configured) return

  const users = await prisma.user.findMany({
    where: { remnawaveUuid: { not: null } },
    select: { id: true, remnawaveUuid: true, subStatus: true, subExpireAt: true },
  })

  let synced = 0
  const statusMap: Record<string, string> = {
    ACTIVE: 'ACTIVE', DISABLED: 'INACTIVE', LIMITED: 'ACTIVE', EXPIRED: 'EXPIRED',
  }

  for (const user of users) {
    try {
      const rm = await remnawave.getUserByUuid(user.remnawaveUuid!)
      const newStatus = statusMap[rm.status] || 'INACTIVE'
      const newExpire = rm.expireAt ? new Date(rm.expireAt) : null

      if (newStatus !== user.subStatus || newExpire?.getTime() !== user.subExpireAt?.getTime()) {
        await prisma.user.update({
          where: { id: user.id },
          data: { subStatus: newStatus as any, subExpireAt: newExpire },
        })
        synced++
      }
    } catch {}
  }

  if (synced > 0) logger.info(`Synced ${synced} subscriptions`)
}
