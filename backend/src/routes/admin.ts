import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { loadDbSettings } from '../config'
import { remnawave } from '../services/remnawave'

export async function adminRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  // GET /stats — full dashboard data (single request)
  app.get('/stats', admin, async () => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000)
    const sevenDaysAgo  = new Date(now.getTime() - 7 * 86400_000)

    const [
      totalUsers, activeUsers, usersWithPayment,
      todayUsersWeb, todayUsersBot,
      totalPayments, paidPayments,
      totalTransactions, totalPartners,
      revenue, todayRevenueAgg,
      expenses, income,
      recentPaymentsRaw, recentTransactionsRaw,
      tariffBreakdown,
      milestones,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { subStatus: 'ACTIVE' } }),
      prisma.user.count({ where: { paymentsCount: { gt: 0 } } }),
      // Today registrations: web (has email, no telegramId) vs bot (has telegramId)
      prisma.user.count({ where: { createdAt: { gte: todayStart }, email: { not: null }, telegramId: null } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart }, telegramId: { not: null } } }),
      prisma.payment.count(),
      prisma.payment.count({ where: { status: 'PAID' } }),
      prisma.transaction.count(),
      prisma.partner.count({ where: { isActive: true } }),
      prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { status: 'PAID', paidAt: { gte: todayStart } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { type: 'EXPENSE' }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { type: 'INCOME' }, _sum: { amount: true } }),
      // Recent payments (last 10)
      prisma.payment.findMany({
        where: { status: 'PAID' },
        select: { id: true, amount: true, currency: true, provider: true, paidAt: true,
          user: { select: { telegramName: true, email: true } },
          tariff: { select: { name: true } } },
        orderBy: { paidAt: 'desc' }, take: 10,
      }),
      // Recent transactions (last 10)
      prisma.transaction.findMany({
        select: { id: true, type: true, amount: true, date: true, description: true,
          category: { select: { name: true, color: true } } },
        orderBy: { date: 'desc' }, take: 10,
      }),
      // Tariff breakdown
      prisma.payment.groupBy({
        by: ['tariffId'],
        where: { status: 'PAID', tariffId: { not: null } },
        _count: true, _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } }, take: 8,
      }),
      // Milestones
      prisma.milestone.findMany({ where: { isCompleted: false }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ])

    // Tariff names for breakdown
    const tariffIds = tariffBreakdown.map(t => t.tariffId!).filter(Boolean)
    const tariffNames = await prisma.tariff.findMany({ where: { id: { in: tariffIds } }, select: { id: true, name: true } })
    const tariffMap = new Map(tariffNames.map(t => [t.id, t.name]))

    // Revenue chart — last 30 days
    const recentPaymentsChart = await prisma.payment.findMany({
      where: { status: 'PAID', paidAt: { gte: thirtyDaysAgo } },
      select: { amount: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    })
    const chartMap = new Map<string, number>()
    for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
      chartMap.set(d.toISOString().slice(0, 10), 0)
    }
    for (const p of recentPaymentsChart) {
      if (p.paidAt) {
        const key = p.paidAt.toISOString().slice(0, 10)
        chartMap.set(key, (chartMap.get(key) || 0) + Number(p.amount))
      }
    }
    const revenueChart = [...chartMap.entries()].map(([date, amount]) => ({ date, amount }))

    // Week revenue for trend
    const weekRevenueAgg = await prisma.payment.aggregate({
      where: { status: 'PAID', paidAt: { gte: sevenDaysAgo } }, _sum: { amount: true },
    })
    const prevWeekAgg = await prisma.payment.aggregate({
      where: { status: 'PAID', paidAt: { gte: new Date(now.getTime() - 14 * 86400_000), lt: sevenDaysAgo } }, _sum: { amount: true },
    })
    const weekRevenue = Number(weekRevenueAgg._sum.amount || 0)
    const prevWeekRevenue = Number(prevWeekAgg._sum.amount || 0)
    const weekTrend = prevWeekRevenue > 0 ? ((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100 : 0

    // REMNAWAVE data (inline, not separate call)
    let remnawaveData = null
    if (remnawave.configured) {
      try {
        const [health, nodes] = await Promise.all([
          remnawave.getSystemStats(),
          remnawave.getNodes(),
        ])
        remnawaveData = { ...health, nodes }
      } catch {}
    }

    // Ad campaigns summary
    const campaigns = await prisma.adCampaign.findMany({
      select: { id: true, channelName: true, format: true, amount: true, subscribersGained: true, utmCode: true, date: true },
      orderBy: { createdAt: 'desc' }, take: 5,
    })

    return {
      users:    { total: totalUsers, active: activeUsers, withPayment: usersWithPayment },
      today:    {
        revenue:        Number(todayRevenueAgg._sum.amount || 0),
        registrations:  todayUsersWeb + todayUsersBot,
        regWeb:         todayUsersWeb,
        regBot:         todayUsersBot,
      },
      payments: { total: totalPayments, paid: paidPayments, revenue: Number(revenue._sum.amount || 0) },
      accounting: {
        income:       Number(income._sum.amount || 0),
        expenses:     Number(expenses._sum.amount || 0),
        transactions: totalTransactions,
      },
      partners: totalPartners,
      revenueChart,
      weekTrend,
      conversion: totalUsers > 0 ? Math.round((usersWithPayment / totalUsers) * 100) : 0,
      remnawave: remnawaveData,
      recentPayments: recentPaymentsRaw.map(p => ({
        id: p.id, amount: Number(p.amount), currency: p.currency, provider: p.provider,
        paidAt: p.paidAt, userName: p.user?.telegramName || p.user?.email || '—',
        tariffName: p.tariff?.name || '—',
      })),
      recentTransactions: recentTransactionsRaw.map(t => ({
        id: t.id, type: t.type, amount: Number(t.amount), date: t.date,
        description: t.description, categoryName: t.category?.name, categoryColor: t.category?.color,
      })),
      tariffBreakdown: tariffBreakdown.map(t => ({
        name: tariffMap.get(t.tariffId!) || '—', count: t._count, revenue: Number(t._sum.amount || 0),
      })),
      milestones: milestones.map(m => ({
        id: m.id, name: m.title, targetAmount: Number(m.targetAmount), currentAmount: Number(m.currentAmount),
        type: m.type,
      })),
      campaigns: campaigns.map(c => ({
        id: c.id, name: c.channelName, format: c.format, amount: Number(c.amount),
        subscribers: c.subscribersGained, cps: c.subscribersGained > 0 ? Number(c.amount) / c.subscribersGained : 0,
      })),
    }
  })

  // GET /settings
  app.get('/settings', admin, async () => {
    const rows = await prisma.setting.findMany()
    const settings: Record<string, string> = {}
    for (const r of rows) settings[r.key] = r.value
    return settings
  })

  // PUT /settings
  app.put('/settings', { preHandler: [app.adminStrict] }, async (req) => {
    const body = req.body as Record<string, string>
    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== 'string') continue
      await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
    }
    await loadDbSettings()
    return { ok: true }
  })

  // POST /danger/wipe
  app.post('/danger/wipe', { preHandler: [app.adminStrict] }, async (req) => {
    const adminId = (req.user as any).id
    const tables = [
      'auditLog', 'botMessage', 'promoUsage', 'emailVerification',
      'balanceTransaction', 'userTag', 'userVariable', 'adminNote',
      'notificationRead', 'notification', 'referralBonus',
      'giftSubscription', 'session', 'importRecord',
      'payment', 'inkasRecord', 'transaction', 'autoTagRule',
      'recurringPayment', 'server', 'partner',
      'adCampaign', 'monthlyStats', 'milestone',
      'broadcast', 'funnelLog', 'funnelStep', 'funnel',
      'botBlockStat', 'botTrigger', 'botButton', 'botBlock', 'botBlockGroup',
      'notificationChannel', 'promoCode', 'news',
      'instructionStep', 'instructionApp', 'instructionPlatform',
      'telegramProxy', 'setting', 'category',
    ]
    let deleted = 0
    for (const table of tables) {
      try { const r = await (prisma as any)[table].deleteMany({}); deleted += r.count } catch {}
    }
    const userResult = await prisma.user.deleteMany({ where: { id: { not: adminId } } })
    deleted += userResult.count
    try { deleted += (await prisma.tariff.deleteMany({})).count } catch {}
    await prisma.user.update({ where: { id: adminId }, data: { totalPaid: 0, paymentsCount: 0, bonusDays: 0 } })
    return { ok: true, deleted, message: `Удалено ${deleted} записей.` }
  })
}
