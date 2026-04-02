import type { FastifyInstance } from 'fastify'
import { z }      from 'zod'
import { prisma } from '../db'

export async function newsRoutes(app: FastifyInstance) {
  // Public: list active news & promotions
  app.get('/', async (req) => {
    const { page = '1', limit: rawLimit = '20', type = '' } = req.query as Record<string, string>
    const limit = Math.min(Math.max(Number(rawLimit) || 20, 1), 100)
    const skip  = (Number(page) - 1) * limit
    const where: any = {
      isActive: true,
      OR: [
        { publishAt: null },
        { publishAt: { lte: new Date() } },
      ],
    }
    if (type === 'NEWS' || type === 'PROMOTION') where.type = type

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        where,
        orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.news.count({ where }),
    ])

    return { news, total }
  })

  // Public: single news item
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const item = await prisma.news.findUnique({ where: { id } })
    if (!item || !item.isActive) return reply.status(404).send({ error: 'Not found' })
    return item
  })
}

// Admin CRUD
export async function adminNewsRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  const NewsSchema = z.object({
    type:      z.enum(['NEWS', 'PROMOTION']).default('NEWS'),
    title:     z.string().min(1),
    content:   z.string().min(1),
    imageUrl:  z.string().optional().nullable(),
    ctaText:   z.string().optional().nullable(),
    ctaUrl:    z.string().optional().nullable(),
    isActive:  z.boolean().default(true),
    sortOrder: z.number().int().default(0),
    publishAt: z.string().datetime().optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
  })

  app.get('/', admin, async (req) => {
    const { page = '1', limit: rawLim = '50' } = req.query as Record<string, string>
    const limit = Math.min(Math.max(Number(rawLim) || 50, 1), 100)
    const skip = (Number(page) - 1) * limit

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.news.count(),
    ])

    return { news, total }
  })

  app.post('/', admin, async (req, reply) => {
    const data = NewsSchema.parse(req.body)
    const item = await prisma.news.create({
      data: {
        ...data,
        publishAt: data.publishAt ? new Date(data.publishAt) : new Date(),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    })
    return reply.status(201).send(item)
  })

  app.put('/:id', admin, async (req) => {
    const { id } = req.params as { id: string }
    const data   = NewsSchema.partial().parse(req.body)
    return prisma.news.update({
      where: { id },
      data:  {
        ...data,
        publishAt: data.publishAt ? new Date(data.publishAt) : undefined,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
    })
  })

  app.delete('/:id', admin, async (req) => {
    const { id } = req.params as { id: string }
    await prisma.news.delete({ where: { id } })
    return { ok: true }
  })

  // Publish / unpublish
  app.post('/:id/publish', admin, async (req) => {
    const { id } = req.params as { id: string }
    return prisma.news.update({
      where: { id },
      data:  { isActive: true, publishAt: new Date() },
    })
  })

  app.post('/:id/unpublish', admin, async (req) => {
    const { id } = req.params as { id: string }
    return prisma.news.update({
      where: { id },
      data:  { isActive: false },
    })
  })
}
