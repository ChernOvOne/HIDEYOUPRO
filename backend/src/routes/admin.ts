import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'

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
    return { ok: true }
  })
}
