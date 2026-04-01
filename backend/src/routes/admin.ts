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

    // Revenue chart — last 30 days of PAID payments by day
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentPayments = await prisma.payment.findMany({
      where: { status: 'PAID', paidAt: { gte: thirtyDaysAgo } },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    })

    // Group by date
    const chartMap = new Map<string, number>()
    for (let d = new Date(thirtyDaysAgo); d <= new Date(); d.setDate(d.getDate() + 1)) {
      chartMap.set(d.toISOString().slice(0, 10), 0)
    }
    for (const p of recentPayments) {
      if (p.paidAt) {
        const key = p.paidAt.toISOString().slice(0, 10)
        chartMap.set(key, (chartMap.get(key) || 0) + Number(p.amount))
      }
    }
    const revenueChart = [...chartMap.entries()].map(([date, amount]) => ({ date, amount }))

    // Conversion rate
    const usersWithPayment = await prisma.user.count({ where: { paymentsCount: { gt: 0 } } })
    const conversion = totalUsers > 0 ? Math.round((usersWithPayment / totalUsers) * 100) : 0

    return {
      users:    { total: totalUsers, active: activeUsers, withPayment: usersWithPayment },
      payments: { total: totalPayments, paid: paidPayments, revenue: Number(revenue._sum.amount || 0) },
      accounting: {
        income:   Number(income._sum.amount || 0),
        expenses: Number(expenses._sum.amount || 0),
        transactions: totalTransactions,
      },
      partners: totalPartners,
      revenueChart,
      conversion,
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
