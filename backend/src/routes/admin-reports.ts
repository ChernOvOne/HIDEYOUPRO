import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db'

export async function adminReportRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  // POST /data — get report data for date range
  app.post('/data', admin, async (req) => {
    const body = z.object({
      dateFrom: z.string(),
      dateTo:   z.string(),
    }).parse(req.body)

    const from = new Date(body.dateFrom)
    const to   = new Date(body.dateTo)
    to.setHours(23, 59, 59, 999)

    const [
      incomeAgg, expenseAgg, payments, transactions,
      topCategories, userCount, paymentCount,
    ] = await Promise.all([
      prisma.transaction.aggregate({ where: { type: 'INCOME', date: { gte: from, lte: to } }, _sum: { amount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { type: 'EXPENSE', date: { gte: from, lte: to } }, _sum: { amount: true }, _count: true }),
      prisma.payment.aggregate({ where: { status: 'PAID', paidAt: { gte: from, lte: to } }, _sum: { amount: true }, _count: true }),
      prisma.transaction.findMany({
        where: { date: { gte: from, lte: to } },
        include: { category: { select: { name: true, color: true } } },
        orderBy: { date: 'desc' },
        take: 200,
      }),
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { date: { gte: from, lte: to }, categoryId: { not: null } },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      }),
      prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.payment.count({ where: { status: 'PAID', paidAt: { gte: from, lte: to } } }),
    ])

    const catIds = topCategories.map(c => c.categoryId!).filter(Boolean)
    const cats = await prisma.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true, color: true } })
    const catMap = new Map(cats.map(c => [c.id, c]))

    return {
      period: { from: body.dateFrom, to: body.dateTo },
      summary: {
        income:     Number(incomeAgg._sum.amount || 0),
        expense:    Number(expenseAgg._sum.amount || 0),
        profit:     Number(incomeAgg._sum.amount || 0) - Number(expenseAgg._sum.amount || 0),
        revenue:    Number(payments._sum.amount || 0),
        incomeCount: incomeAgg._count,
        expenseCount: expenseAgg._count,
        newUsers:    userCount,
        paidPayments: paymentCount,
      },
      topCategories: topCategories.map(c => ({
        category: catMap.get(c.categoryId!) || { name: 'Без категории', color: '#999' },
        amount:   Number(c._sum.amount || 0),
        count:    c._count,
      })),
      transactions: transactions.map(t => ({
        id:          t.id,
        type:        t.type,
        amount:      Number(t.amount),
        date:        t.date,
        description: t.description,
        category:    t.category,
      })),
    }
  })
}
