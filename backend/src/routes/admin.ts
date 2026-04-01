import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { loadDbSettings } from '../config'

export async function adminRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  // GET /stats — dashboard overview
  app.get('/stats', admin, async () => {
    const [
      totalUsers, activeUsers, totalPayments, paidPayments,
      totalTransactions, totalPartners,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { subStatus: 'ACTIVE' } }),
      prisma.payment.count(),
      prisma.payment.count({ where: { status: 'PAID' } }),
      prisma.transaction.count(),
      prisma.partner.count({ where: { isActive: true } }),
    ])

    // Revenue (paid payments)
    const revenue = await prisma.payment.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
    })

    // Expenses
    const expenses = await prisma.transaction.aggregate({
      where: { type: 'EXPENSE' },
      _sum: { amount: true },
    })

    // Income from transactions
    const income = await prisma.transaction.aggregate({
      where: { type: 'INCOME' },
      _sum: { amount: true },
    })

    return {
      users:    { total: totalUsers, active: activeUsers },
      payments: { total: totalPayments, paid: paidPayments, revenue: revenue._sum.amount || 0 },
      accounting: {
        income:   income._sum.amount || 0,
        expenses: expenses._sum.amount || 0,
        transactions: totalTransactions,
      },
      partners: totalPartners,
    }
  })

  // GET /settings — all settings
  app.get('/settings', admin, async () => {
    const rows = await prisma.setting.findMany()
    const settings: Record<string, string> = {}
    for (const r of rows) settings[r.key] = r.value
    return settings
  })

  // PUT /settings — update settings
  app.put('/settings', { preHandler: [app.adminStrict] }, async (req) => {
    const body = req.body as Record<string, string>
    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== 'string') continue
      await prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    }
    await loadDbSettings()
    return { ok: true }
  })

  // POST /danger/wipe — wipe entire database except current admin
  app.post('/danger/wipe', { preHandler: [app.adminStrict] }, async (req) => {
    const adminId = (req.user as any).id

    // Delete in correct order (foreign keys)
    const tables = [
      'auditLog', 'botMessage', 'promoUsage', 'emailVerification',
      'balanceTransaction', 'userTag', 'userVariable', 'adminNote',
      'notificationRead', 'notification', 'referralBonus',
      'giftSubscription', 'session', 'importRecord',
      'payment', 'inkasRecord',
      'transaction', 'autoTagRule',
      'recurringPayment', 'server', 'partner',
      'campaign', 'monthlyStats', 'milestone',
      'broadcastLog', 'broadcast',
      'funnelStepAction', 'funnelStepCondition', 'funnelStep', 'funnel',
      'botBlock', 'botBlockGroup',
      'notificationChannel',
      'promoCode', 'newsArticle', 'instructionStep', 'instructionApp', 'instructionPlatform',
      'proxy', 'landingSection', 'category',
    ]

    let deleted = 0
    for (const table of tables) {
      try {
        const result = await (prisma as any)[table].deleteMany({})
        deleted += result.count
      } catch {}
    }

    // Delete all users EXCEPT current admin
    const userResult = await prisma.user.deleteMany({
      where: { id: { not: adminId } },
    })
    deleted += userResult.count

    // Delete tariffs
    try {
      const tariffResult = await prisma.tariff.deleteMany({})
      deleted += tariffResult.count
    } catch {}

    // Reset admin stats
    await prisma.user.update({
      where: { id: adminId },
      data: { totalPaid: 0, paymentsCount: 0, bonusDays: 0 },
    })

    return { ok: true, deleted, message: `Удалено ${deleted} записей. Ваша учётка сохранена.` }
  })
}
