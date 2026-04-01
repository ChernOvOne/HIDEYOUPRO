import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db'

export async function adminPartnerRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  app.get('/', admin, async () => {
    const partners = await prisma.partner.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { inkasRecords: true } },
        inkasRecords: { orderBy: { date: 'desc' }, take: 3 },
      },
    })

    return partners.map(p => {
      const totalDividends = Number(p.initialDividends) +
        p.inkasRecords.filter(r => r.type === 'DIVIDEND').reduce((s, r) => s + Number(r.amount), 0)
      const totalReturned = Number(p.initialReturned) +
        p.inkasRecords.filter(r => r.type === 'RETURN_INV').reduce((s, r) => s + Number(r.amount), 0)
      const totalInvested = Number(p.initialInvestment) +
        p.inkasRecords.filter(r => r.type === 'INVESTMENT').reduce((s, r) => s + Number(r.amount), 0)
      return { ...p, totalDividends, totalReturned, totalInvested, debt: totalInvested - totalReturned }
    })
  })

  app.get<{ Params: { id: string } }>('/:id', admin, async (req) => {
    return prisma.partner.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        inkasRecords: { orderBy: { date: 'desc' }, include: { createdBy: { select: { telegramName: true } } } },
        user: { select: { id: true, email: true, telegramName: true } },
      },
    })
  })

  app.post('/', admin, async (req) => {
    const body = z.object({
      name:              z.string().min(1),
      roleLabel:         z.string().optional(),
      tgUsername:         z.string().optional(),
      sharePercent:       z.number().min(0).max(100).default(0),
      avatarColor:       z.string().optional(),
      initials:          z.string().optional(),
      notes:             z.string().optional(),
      initialInvestment: z.number().default(0),
      initialReturned:   z.number().default(0),
      initialDividends:  z.number().default(0),
    }).parse(req.body)
    return prisma.partner.create({ data: body as any })
  })

  app.put<{ Params: { id: string } }>('/:id', admin, async (req) => {
    const body = z.object({
      name:              z.string().min(1).optional(),
      roleLabel:         z.string().optional(),
      tgUsername:         z.string().optional(),
      sharePercent:       z.number().min(0).max(100).optional(),
      notes:             z.string().optional(),
      isActive:          z.boolean().optional(),
    }).parse(req.body)
    return prisma.partner.update({ where: { id: req.params.id }, data: body as any })
  })

  app.delete<{ Params: { id: string } }>('/:id', admin, async (req) => {
    await prisma.partner.update({ where: { id: req.params.id }, data: { isActive: false } })
    return { ok: true }
  })

  // Inkas (dividends, returns, investments)
  app.post('/inkas', admin, async (req) => {
    const body = z.object({
      partnerId:   z.string(),
      type:        z.enum(['DIVIDEND', 'RETURN_INV', 'INVESTMENT']),
      amount:      z.number().positive(),
      date:        z.string(),
      monthLabel:  z.string().optional(),
      description: z.string().optional(),
    }).parse(req.body)

    return prisma.inkasRecord.create({
      data: {
        ...body,
        date: new Date(body.date),
        createdById: (req.user as any).id,
      },
    })
  })

  app.get<{ Params: { partnerId: string } }>('/inkas/:partnerId', admin, async (req) => {
    return prisma.inkasRecord.findMany({
      where: { partnerId: req.params.partnerId },
      orderBy: { date: 'desc' },
      include: { createdBy: { select: { telegramName: true } } },
    })
  })

  app.delete<{ Params: { id: string } }>('/inkas/record/:id', admin, async (req) => {
    await prisma.inkasRecord.delete({ where: { id: req.params.id } })
    return { ok: true }
  })
}
