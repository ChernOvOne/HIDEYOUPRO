import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db'
import { remnawave } from '../services/remnawave'

export async function adminAnalyticsRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  // GET /overview — main analytics data
  app.get('/overview', admin, async (req) => {
    const qs = z.object({
      days: z.coerce.number().int().default(30),
    }).parse(req.query)

    const since = new Date(Date.now() - qs.days * 86400_000)

    const [
      newUsers, activeUsers, paidPayments, totalRevenue,
      newTransactions, expenses, recentPayments,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: since } } }),
      prisma.user.count({ where: { subStatus: 'ACTIVE' } }),
      prisma.payment.count({ where: { status: 'PAID', paidAt: { gte: since } } }),
      prisma.payment.aggregate({ where: { status: 'PAID', paidAt: { gte: since } }, _sum: { amount: true } }),
      prisma.transaction.count({ where: { createdAt: { gte: since } } }),
      prisma.transaction.aggregate({ where: { type: 'EXPENSE', date: { gte: since } }, _sum: { amount: true } }),
      prisma.payment.findMany({
        where: { status: 'PAID', paidAt: { gte: since } },
        select: { amount: true, paidAt: true },
        orderBy: { paidAt: 'asc' },
      }),
    ])

    // Group payments by day for chart
    const dailyRevenue: Record<string, number> = {}
    for (const p of recentPayments) {
      const day = (p.paidAt || new Date()).toISOString().split('T')[0]
      dailyRevenue[day] = (dailyRevenue[day] || 0) + Number(p.amount)
    }

    // Daily registrations for chart
    const recentUsers = await prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    const dailyUsers: Record<string, number> = {}
    for (const u of recentUsers) {
      const day = u.createdAt.toISOString().split('T')[0]
      dailyUsers[day] = (dailyUsers[day] || 0) + 1
    }

    // Top tariffs
    const topTariffs = await prisma.payment.groupBy({
      by: ['tariffId'],
      where: { status: 'PAID', paidAt: { gte: since }, tariffId: { not: null } },
      _count: true,
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 5,
    })
    const tariffIds = topTariffs.map(t => t.tariffId!).filter(Boolean)
    const tariffNames = await prisma.tariff.findMany({
      where: { id: { in: tariffIds } },
      select: { id: true, name: true },
    })
    const tariffMap = new Map(tariffNames.map(t => [t.id, t.name]))

    // Category breakdown
    const categoryBreakdown = await prisma.transaction.groupBy({
      by: ['categoryId', 'type'],
      where: { date: { gte: since }, categoryId: { not: null } },
      _sum: { amount: true },
      _count: true,
    })
    const catIds = [...new Set(categoryBreakdown.map(c => c.categoryId!).filter(Boolean))]
    const cats = await prisma.category.findMany({
      where: { id: { in: catIds } },
      select: { id: true, name: true, color: true },
    })
    const catMap = new Map(cats.map(c => [c.id, c]))

    return {
      period: { days: qs.days, since: since.toISOString() },
      kpi: {
        newUsers,
        activeUsers,
        paidPayments,
        revenue:  Number(totalRevenue._sum.amount || 0),
        expenses: Number(expenses._sum.amount || 0),
        profit:   Number(totalRevenue._sum.amount || 0) - Number(expenses._sum.amount || 0),
        transactions: newTransactions,
      },
      charts: {
        dailyRevenue: Object.entries(dailyRevenue).map(([date, amount]) => ({ date, amount })),
        dailyUsers:   Object.entries(dailyUsers).map(([date, count]) => ({ date, count })),
      },
      topTariffs: topTariffs.map(t => ({
        name:    tariffMap.get(t.tariffId!) || '—',
        count:   t._count,
        revenue: Number(t._sum.amount || 0),
      })),
      categoryBreakdown: categoryBreakdown.map(c => ({
        category: catMap.get(c.categoryId!) || { name: 'Без категории', color: '#999' },
        type:     c.type,
        amount:   Number(c._sum.amount || 0),
        count:    c._count,
      })),
    }
  })

  // GET /remnawave — VPN node stats
  app.get('/remnawave', admin, async () => {
    try {
      const [health, nodes] = await Promise.all([
        remnawave.getHealth(),
        remnawave.getNodes(),
      ])
      return { health, nodes }
    } catch {
      return { health: { online: false }, nodes: [] }
    }
  })

  // GET /audit — audit log
  app.get('/audit', admin, async (req) => {
    const qs = z.object({
      page:  z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      entity: z.string().optional(),
    }).parse(req.query)

    const where: any = {}
    if (qs.entity) where.entity = qs.entity

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, telegramName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (qs.page - 1) * qs.limit,
        take: qs.limit,
      }),
      prisma.auditLog.count({ where }),
    ])

    return { logs, total }
  })
}
