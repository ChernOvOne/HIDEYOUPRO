import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db'

export async function adminTariffRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  app.get('/', admin, async () => {
    return prisma.tariff.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { payments: true } } },
    })
  })

  app.post('/', admin, async (req) => {
    const body = z.object({
      name:            z.string().min(1),
      description:     z.string().optional(),
      priceRub:        z.number().positive(),
      priceUsdt:       z.number().optional(),
      durationDays:    z.number().int().positive(),
      trafficGb:       z.number().int().nullable().optional(),
      deviceLimit:     z.number().int().default(3),
      countries:       z.string().optional(),
      protocol:        z.string().optional(),
      speed:           z.string().optional(),
      sortOrder:       z.number().int().optional(),
      isActive:        z.boolean().default(true),
      isVisible:       z.boolean().default(true),
      isTrial:         z.boolean().default(false),
      type:            z.enum(['SUBSCRIPTION', 'TRAFFIC_ADDON']).default('SUBSCRIPTION'),
      remnawaveTag:    z.string().optional(),
      remnawaveSquads: z.array(z.string()).default([]),
      trafficStrategy: z.string().optional(),
      mode:            z.string().default('single'),
      variants:        z.any().optional(),
    }).parse(req.body)

    return prisma.tariff.create({ data: body as any })
  })

  app.put<{ Params: { id: string } }>('/:id', admin, async (req) => {
    const body = z.object({
      name:            z.string().min(1).optional(),
      description:     z.string().nullable().optional(),
      priceRub:        z.number().positive().optional(),
      priceUsdt:       z.number().nullable().optional(),
      durationDays:    z.number().int().optional(),
      trafficGb:       z.number().int().nullable().optional(),
      deviceLimit:     z.number().int().optional(),
      countries:       z.string().nullable().optional(),
      protocol:        z.string().nullable().optional(),
      speed:           z.string().nullable().optional(),
      sortOrder:       z.number().int().optional(),
      isActive:        z.boolean().optional(),
      isVisible:       z.boolean().optional(),
      isTrial:         z.boolean().optional(),
      remnawaveTag:    z.string().nullable().optional(),
      remnawaveSquads: z.array(z.string()).optional(),
      trafficStrategy: z.string().nullable().optional(),
      mode:            z.string().optional(),
      variants:        z.any().optional(),
    }).parse(req.body)

    return prisma.tariff.update({ where: { id: req.params.id }, data: body as any })
  })

  app.delete<{ Params: { id: string } }>('/:id', admin, async (req) => {
    await prisma.tariff.delete({ where: { id: req.params.id } })
    return { ok: true }
  })
}
