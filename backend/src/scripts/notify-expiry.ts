import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Run daily — notify users whose subscription expires in 3 days or 1 day
 */
export async function runExpiryNotifications() {
  console.log('Running expiry notifications...')

  const now      = new Date()
  const in3days  = new Date(now.getTime() + 3 * 86400_000)
  const in1day   = new Date(now.getTime() + 1 * 86400_000)
  const window   = 12 * 3600_000  // 12h window to avoid double-notifs

  const candidates = await prisma.user.findMany({
    where: {
      subStatus:   'ACTIVE',
      telegramId:  { not: null },
      subExpireAt: {
        gte: new Date(in1day.getTime() - window),
        lte: in3days,
      },
    },
    select: { id: true, telegramId: true, subExpireAt: true },
  })

  console.log(`Found ${candidates.length} users to notify`)

  // Dynamic import to avoid loading bot at script level
  const { notifications } = await import('../services/notifications')

  for (const user of candidates) {
    if (!user.telegramId || !user.subExpireAt) continue
    const daysLeft = Math.ceil(
      (user.subExpireAt.getTime() - now.getTime()) / 86400_000,
    )
    if (daysLeft <= 3 && daysLeft >= 0) {
      await notifications.subscriptionExpiring(user.id, daysLeft).catch(() => {})
      await new Promise(r => setTimeout(r, 100)) // rate limit
    }
  }

  console.log('Expiry notifications done')
}

// Run if executed directly
if (require.main === module) {
  runExpiryNotifications()
    .catch(err => { console.error('Cron failed:', err); process.exit(1) })
    .finally(() => prisma.$disconnect())
}
