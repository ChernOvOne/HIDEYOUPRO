import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db'

export async function adminServerRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  app.get('/', admin, async () => {
    const servers = await prisma.server.findMany({
      where: { isActive: true },
      orderBy: { nextPaymentDate: 'asc' },
      include: { recurringPayments: true },
    })

    return servers.map(s => {
      const daysUntilPayment = s.nextPaymentDate
        ? Math.ceil((new Date(s.nextPaymentDate).getTime() - Date.now()) / 86400_000)
        : null
      const autoStatus = daysUntilPayment !== null
        ? daysUntilPayment < 0 ? 'EXPIRED' : daysUntilPayment <= s.notifyDaysBefore ? 'WARNING' : 'ACTIVE'
        : s.status
      return { ...s, daysUntilPayment, computedStatus: autoStatus }
    })
  })

  app.post('/', admin, async (req) => {
    const body = z.object({
      name:            z.string().min(1),
      provider:        z.string().optional(),
      ipAddress:       z.string().optional(),
      purpose:         z.string().optional(),
      panelUrl:        z.string().optional(),
      monthlyCost:     z.number().default(0),
      currency:        z.string().default('RUB'),
      paymentDay:      z.number().int().min(1).max(31).optional(),
      nextPaymentDate: z.string().optional(),
      notifyDaysBefore:z.number().int().default(3),
      notes:           z.string().optional(),
    }).parse(req.body)
    return prisma.server.create({
      data: { ...body, nextPaymentDate: body.nextPaymentDate ? new Date(body.nextPaymentDate) : undefined } as any,
    })
  })

  app.put<{ Params: { id: string } }>('/:id', admin, async (req) => {
    const body = z.object({
      name:            z.string().optional(),
      provider:        z.string().optional(),
      ipAddress:       z.string().optional(),
      purpose:         z.string().optional(),
      panelUrl:        z.string().optional(),
      monthlyCost:     z.number().optional(),
      currency:        z.string().optional(),
      paymentDay:      z.number().int().optional(),
      nextPaymentDate: z.string().nullable().optional(),
      notifyDaysBefore:z.number().int().optional(),
      notes:           z.string().optional(),
      status:          z.enum(['ACTIVE', 'WARNING', 'EXPIRED', 'INACTIVE']).optional(),
    }).parse(req.body)
    return prisma.server.update({
      where: { id: req.params.id },
      data: { ...body, nextPaymentDate: body.nextPaymentDate ? new Date(body.nextPaymentDate) : body.nextPaymentDate === null ? null : undefined } as any,
    })
  })

  app.delete<{ Params: { id: string } }>('/:id', admin, async (req) => {
    await prisma.server.update({ where: { id: req.params.id }, data: { isActive: false } })
    return { ok: true }
  })
}
