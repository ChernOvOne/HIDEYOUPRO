/**
 * Trial subscription creation — extracted for reuse by bot engine
 */

import { prisma }    from '../db'
import { config }    from '../config'
import { remnawave } from '../services/remnawave'

export async function createTrialForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')
  if (user.remnawaveUuid) throw new Error('Уже есть подписка')

  const trialDays = config.features.trialDays || 3
  const cheapestTariff = await prisma.tariff.findFirst({
    where: { isActive: true, type: 'SUBSCRIPTION' },
    orderBy: { priceRub: 'asc' },
  })
  if (!cheapestTariff) throw new Error('Нет доступных тарифов')

  const trafficLimitBytes = cheapestTariff.trafficGb ? cheapestTariff.trafficGb * 1024 * 1024 * 1024 : 0
  const expireAt = new Date(Date.now() + trialDays * 86400_000).toISOString()

  const rmUser = await remnawave.createUser({
    username: user.email
      ? user.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '_')
      : user.telegramId
        ? `tg_${user.telegramId}`
        : `user_${user.id.slice(0, 8)}`,
    email: user.email ?? undefined,
    telegramId: user.telegramId ? parseInt(user.telegramId, 10) : null,
    expireAt,
    trafficLimitBytes,
    trafficLimitStrategy: cheapestTariff.trafficStrategy || 'MONTH',
    hwidDeviceLimit: cheapestTariff.deviceLimit ?? 3,
    tag: cheapestTariff.remnawaveTag ?? undefined,
    activeInternalSquads: cheapestTariff.remnawaveSquads.length > 0 ? cheapestTariff.remnawaveSquads : undefined,
  })

  await prisma.user.update({
    where: { id: userId },
    data: {
      remnawaveUuid: rmUser.uuid,
      subLink: remnawave.getSubscriptionUrl(rmUser.uuid),
      subStatus: 'ACTIVE',
      subExpireAt: new Date(expireAt),
    },
  })

  return { days: trialDays, tariffName: cheapestTariff.name }
}
