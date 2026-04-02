import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db'

export async function adminAccountingRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  // ════════════════════════════════════════════════════════════
  //  TRANSACTIONS
  // ════════════════════════════════════════════════════════════

  // GET /transactions
  app.get('/transactions', admin, async (req) => {
    const qs = z.object({
      type:       z.enum(['INCOME', 'EXPENSE']).optional(),
      categoryId: z.string().optional(),
      dateFrom:   z.string().optional(),
      dateTo:     z.string().optional(),
      search:     z.string().optional(),
      page:       z.coerce.number().int().min(1).default(1),
      limit:      z.coerce.number().int().min(1).max(100).default(50),
    }).parse(req.query)

    const where: any = {}
    if (qs.type)       where.type = qs.type
    if (qs.categoryId) where.categoryId = qs.categoryId
    if (qs.search)     where.description = { contains: qs.search, mode: 'insensitive' }
    if (qs.dateFrom || qs.dateTo) {
      where.date = {}
      if (qs.dateFrom) where.date.gte = new Date(qs.dateFrom)
      if (qs.dateTo)   where.date.lte = new Date(qs.dateTo)
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          createdBy: { select: { id: true, telegramName: true } },
        },
        orderBy: { date: 'desc' },
        skip: (qs.page - 1) * qs.limit,
        take: qs.limit,
      }),
      prisma.transaction.count({ where }),
    ])

    return { transactions, total }
  })

  // POST /transactions — create transaction (auto-tag)
  app.post('/transactions', admin, async (req) => {
    const body = z.object({
      type:        z.enum(['INCOME', 'EXPENSE']),
      amount:      z.number().positive(),
      date:        z.string(),
      categoryId:  z.string().nullable().optional(),
      description: z.string().optional(),
    }).parse(req.body)

    const userId = (req.user as any).id

    // Auto-tag if no category
    let categoryId = body.categoryId || null
    if (!categoryId && body.description) {
      const rules = await prisma.autoTagRule.findMany({
        include: { category: { select: { id: true } } },
      })
      const desc = body.description.toLowerCase()
      for (const rule of rules) {
        if (desc.includes(rule.keyword.toLowerCase())) {
          categoryId = rule.category.id
          break
        }
      }
    }

    return prisma.transaction.create({
      data: {
        type: body.type,
        amount: body.amount,
        date: new Date(body.date),
        categoryId,
        description: body.description,
        createdById: userId,
      },
      include: { category: true },
    })
  })

  // PUT /transactions/:id
  app.put<{ Params: { id: string } }>('/transactions/:id', admin, async (req) => {
    const { id } = req.params
    const body = z.object({
      type:        z.enum(['INCOME', 'EXPENSE']).optional(),
      amount:      z.number().positive().optional(),
      date:        z.string().optional(),
      categoryId:  z.string().nullable().optional(),
      description: z.string().optional(),
    }).parse(req.body)

    return prisma.transaction.update({
      where: { id },
      data: {
        ...body,
        date: body.date ? new Date(body.date) : undefined,
      } as any,
      include: { category: true },
    })
  })

  // DELETE /transactions/:id
  app.delete<{ Params: { id: string } }>('/transactions/:id', admin, async (req) => {
    await prisma.transaction.delete({ where: { id: req.params.id } })
    return { ok: true }
  })

  // GET /summary — income/expense summary by month
  app.get('/summary', admin, async (req) => {
    const qs = z.object({
      year: z.coerce.number().default(new Date().getFullYear()),
    }).parse(req.query)

    const startDate = new Date(`${qs.year}-01-01`)
    const endDate = new Date(`${qs.year + 1}-01-01`)

    const transactions = await prisma.transaction.findMany({
      where: { date: { gte: startDate, lt: endDate } },
      select: { type: true, amount: true, date: true },
      take: 50000,
    })

    // Group by month
    const months: Record<number, { income: number; expense: number }> = {}
    for (let m = 1; m <= 12; m++) months[m] = { income: 0, expense: 0 }

    for (const t of transactions) {
      const m = new Date(t.date).getMonth() + 1
      const amt = Number(t.amount)
      if (t.type === 'INCOME') months[m].income += amt
      else months[m].expense += amt
    }

    return Object.entries(months).map(([month, data]) => ({
      month: Number(month), ...data, profit: data.income - data.expense,
    }))
  })

  // ════════════════════════════════════════════════════════════
  //  CATEGORIES
  // ════════════════════════════════════════════════════════════

  app.get('/categories', admin, async () => {
    return prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { transactions: true } } },
    })
  })

  app.post('/categories', admin, async (req) => {
    const body = z.object({
      name:  z.string().min(1),
      color: z.string().default('#534AB7'),
      icon:  z.string().optional(),
    }).parse(req.body)
    return prisma.category.create({ data: body })
  })

  app.put<{ Params: { id: string } }>('/categories/:id', admin, async (req) => {
    const body = z.object({
      name:      z.string().min(1).optional(),
      color:     z.string().optional(),
      icon:      z.string().optional(),
      isActive:  z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    }).parse(req.body)
    return prisma.category.update({ where: { id: req.params.id }, data: body })
  })

  app.delete<{ Params: { id: string } }>('/categories/:id', admin, async (req) => {
    await prisma.category.delete({ where: { id: req.params.id } })
    return { ok: true }
  })

  // Auto-tag rules
  app.get('/auto-rules', admin, async () => {
    return prisma.autoTagRule.findMany({
      include: { category: { select: { id: true, name: true, color: true } } },
    })
  })

  app.post('/auto-rules', admin, async (req) => {
    const body = z.object({
      categoryId: z.string(),
      keyword:    z.string().min(1),
    }).parse(req.body)
    return prisma.autoTagRule.create({ data: body })
  })

  app.delete<{ Params: { id: string } }>('/auto-rules/:id', admin, async (req) => {
    await prisma.autoTagRule.delete({ where: { id: req.params.id } })
    return { ok: true }
  })
}
