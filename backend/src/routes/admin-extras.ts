import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db'

export async function adminExtrasRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  // ════════════════════════════════════════════════════════════
  //  NOTIFICATION CHANNELS (TG channels for event notifications)
  // ════════════════════════════════════════════════════════════

  app.get('/notification-channels', admin, async () => {
    return prisma.notificationChannel.findMany({ orderBy: { createdAt: 'desc' } })
  })

  app.post('/notification-channels', admin, async (req) => {
    const body = z.object({
      name:           z.string().min(1),
      chatId:         z.string().min(1),
      notifyIncome:   z.boolean().default(true),
      notifyExpense:  z.boolean().default(true),
      notifyInkas:    z.boolean().default(false),
      notifyPayment:  z.boolean().default(true),
      notifyAd:       z.boolean().default(false),
      notifyServer:   z.boolean().default(true),
    }).parse(req.body)
    return prisma.notificationChannel.create({ data: body })
  })

  app.put<{ Params: { id: string } }>('/notification-channels/:id', admin, async (req) => {
    const body = z.object({
      name:           z.string().optional(),
      chatId:         z.string().optional(),
      isActive:       z.boolean().optional(),
      notifyIncome:   z.boolean().optional(),
      notifyExpense:  z.boolean().optional(),
      notifyInkas:    z.boolean().optional(),
      notifyPayment:  z.boolean().optional(),
      notifyAd:       z.boolean().optional(),
      notifyServer:   z.boolean().optional(),
    }).parse(req.body)
    return prisma.notificationChannel.update({ where: { id: req.params.id }, data: body })
  })

  app.delete<{ Params: { id: string } }>('/notification-channels/:id', admin, async (req) => {
    await prisma.notificationChannel.delete({ where: { id: req.params.id } })
    return { ok: true }
  })

  // Test notification
  app.post<{ Params: { id: string } }>('/notification-channels/:id/test', admin, async (req) => {
    const ch = await prisma.notificationChannel.findUniqueOrThrow({ where: { id: req.params.id } })
    try {
      const { bot } = await import('../bot/index')
      await bot.api.sendMessage(ch.chatId, '✅ Тестовое уведомление от HIDEYOU PRO')
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e.message }
    }
  })

  // ════════════════════════════════════════════════════════════
  //  MILESTONES
  // ════════════════════════════════════════════════════════════

  app.get('/milestones', admin, async () => {
    return prisma.milestone.findMany({ orderBy: { createdAt: 'desc' } })
  })

  app.post('/milestones', admin, async (req) => {
    const body = z.object({
      title:        z.string().min(1),
      targetAmount: z.number().positive(),
      type:         z.string().default('revenue'),
    }).parse(req.body)
    return prisma.milestone.create({ data: body as any })
  })

  app.put<{ Params: { id: string } }>('/milestones/:id', admin, async (req) => {
    const body = z.object({
      title:         z.string().optional(),
      targetAmount:  z.number().optional(),
      currentAmount: z.number().optional(),
      isCompleted:   z.boolean().optional(),
    }).parse(req.body)
    return prisma.milestone.update({
      where: { id: req.params.id },
      data: { ...body as any, completedAt: body.isCompleted ? new Date() : undefined },
    })
  })

  app.delete<{ Params: { id: string } }>('/milestones/:id', admin, async (req) => {
    await prisma.milestone.delete({ where: { id: req.params.id } })
    return { ok: true }
  })

  // ════════════════════════════════════════════════════════════
  //  MONTHLY STATS
  // ════════════════════════════════════════════════════════════

  app.get('/monthly-stats', admin, async (req) => {
    const qs = z.object({ year: z.coerce.number().default(new Date().getFullYear()) }).parse(req.query)
    return prisma.monthlyStats.findMany({
      where: { year: qs.year },
      orderBy: { month: 'asc' },
    })
  })

  app.put('/monthly-stats/:year/:month', admin, async (req) => {
    const params = z.object({
      year:  z.coerce.number(),
      month: z.coerce.number().min(1).max(12),
    }).parse(req.params)

    const body = z.object({
      onlineCount:   z.number().int().nullable().optional(),
      onlineWeekly:  z.number().int().nullable().optional(),
      pdpInChannel:  z.number().int().nullable().optional(),
      avgCheck:      z.number().nullable().optional(),
      totalPayments: z.number().int().nullable().optional(),
      totalRefunds:  z.number().int().nullable().optional(),
      tagPaid:       z.number().int().nullable().optional(),
      notes:         z.string().nullable().optional(),
    }).parse(req.body)

    return prisma.monthlyStats.upsert({
      where: { year_month: { year: params.year, month: params.month } },
      create: { year: params.year, month: params.month, ...body as any },
      update: body as any,
    })
  })

  // ════════════════════════════════════════════════════════════
  //  RECURRING PAYMENTS
  // ════════════════════════════════════════════════════════════

  app.get('/recurring', admin, async () => {
    return prisma.recurringPayment.findMany({
      where: { isActive: true },
      include: {
        category: { select: { id: true, name: true, color: true } },
        server:   { select: { id: true, name: true } },
      },
      orderBy: { paymentDay: 'asc' },
    })
  })

  app.post('/recurring', admin, async (req) => {
    const body = z.object({
      name:        z.string().min(1),
      categoryId:  z.string().nullable().optional(),
      amount:      z.number().positive(),
      currency:    z.string().default('RUB'),
      paymentDay:  z.number().int().min(1).max(31),
      description: z.string().optional(),
      serverId:    z.string().nullable().optional(),
    }).parse(req.body)
    return prisma.recurringPayment.create({ data: body as any })
  })

  app.delete<{ Params: { id: string } }>('/recurring/:id', admin, async (req) => {
    await prisma.recurringPayment.delete({ where: { id: req.params.id } })
    return { ok: true }
  })
}
