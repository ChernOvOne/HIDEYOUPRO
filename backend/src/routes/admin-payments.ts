import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

export async function adminPaymentRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  // GET / — list payments with filters
  app.get('/', admin, async (req) => {
    const qs = z.object({
      status:   z.string().optional(),
      provider: z.string().optional(),
      search:   z.string().optional(),
      page:     z.coerce.number().int().min(1).default(1),
      limit:    z.coerce.number().int().min(1).max(100).default(30),
    }).parse(req.query)

    const where: any = {}
    if (qs.status)   where.status = qs.status
    if (qs.provider) where.provider = qs.provider
    if (qs.search) {
      where.OR = [
        { externalId: { contains: qs.search, mode: 'insensitive' } },
        { user: { email: { contains: qs.search, mode: 'insensitive' } } },
        { user: { telegramName: { contains: qs.search, mode: 'insensitive' } } },
      ]
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user:   { select: { id: true, email: true, telegramName: true, telegramId: true } },
          tariff: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (qs.page - 1) * qs.limit,
        take: qs.limit,
      }),
      prisma.payment.count({ where }),
    ])

    return { payments, total }
  })

  // GET /stats — payment stats
  app.get('/stats', admin, async () => {
    const [total, paid, pending, revenue] = await Promise.all([
      prisma.payment.count(),
      prisma.payment.count({ where: { status: 'PAID' } }),
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    ])
    return { total, paid, pending, revenue: Number(revenue._sum.amount || 0) }
  })

  // ── Webhook endpoint (public, API key auth) ───────────────
  // Registered separately — no admin middleware

  // ── API Keys ──────────────────────────────────────────────
  app.get('/keys', admin, async () => {
    return prisma.apiKey.findMany({
      select: { id: true, name: true, isActive: true, lastUsed: true, requestCount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post('/keys', admin, async (req) => {
    const body = z.object({ name: z.string().min(1) }).parse(req.body)
    const rawKey = `hyp_${randomBytes(24).toString('hex')}`
    const keyHash = await bcrypt.hash(rawKey, 10)

    const apiKey = await prisma.apiKey.create({
      data: { name: body.name, keyHash },
    })

    // Return raw key only once — it's hashed in DB
    return { id: apiKey.id, name: apiKey.name, key: rawKey }
  })

  app.delete<{ Params: { id: string } }>('/keys/:id', admin, async (req) => {
    await prisma.apiKey.delete({ where: { id: req.params.id } })
    return { ok: true }
  })
}

// ── Webhook route (separate, no auth middleware) ─────────────
export async function paymentWebhookRoutes(app: FastifyInstance) {
  app.post('/webhook', async (req, reply) => {
    const body = z.object({
      api_key:           z.string(),
      amount:            z.number().positive(),
      currency:          z.string().default('RUB'),
      external_id:       z.string(),
      customer_email:    z.string().optional(),
      customer_id:       z.string().optional(),
      customer_name:     z.string().optional(),
      plan:              z.string().optional(),
      plan_tag:          z.string().optional(),
      subscription_start: z.string().optional(),
      subscription_end:  z.string().optional(),
      description:       z.string().optional(),
      source:            z.string().optional(),
    }).safeParse(req.body)

    if (!body.success) return reply.status(400).send({ error: 'Invalid payload' })
    const data = body.data

    // Verify API key
    const apiKeys = await prisma.apiKey.findMany({ where: { isActive: true } })
    let validKey: any = null
    for (const k of apiKeys) {
      if (await bcrypt.compare(data.api_key, k.keyHash)) { validKey = k; break }
    }
    if (!validKey) return reply.status(401).send({ error: 'Invalid API key' })

    // Update API key stats
    await prisma.apiKey.update({
      where: { id: validKey.id },
      data: { lastUsed: new Date(), requestCount: { increment: 1 } },
    })

    // Check duplicate
    const existing = await prisma.payment.findUnique({ where: { externalId: data.external_id } })
    if (existing) return { ok: true, duplicate: true }

    // Find or create user
    let user = data.customer_id
      ? await prisma.user.findFirst({ where: { OR: [{ telegramId: data.customer_id }, { email: data.customer_email }] } })
      : data.customer_email
        ? await prisma.user.findUnique({ where: { email: data.customer_email } })
        : null

    if (!user && (data.customer_email || data.customer_id)) {
      user = await prisma.user.create({
        data: {
          email: data.customer_email?.toLowerCase(),
          telegramId: data.customer_id,
          telegramName: data.customer_name,
        },
      })
    }

    if (!user) return reply.status(400).send({ error: 'Cannot identify customer' })

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        userId:     user.id,
        amount:     data.amount,
        currency:   data.currency,
        status:     'PAID',
        provider:   'WEBHOOK',
        purpose:    'SUBSCRIPTION',
        externalId: data.external_id,
        description: data.description,
        paidAt:     new Date(),
        metadata:   data as any,
      },
    })

    // Create accounting transaction (auto income)
    const subCategory = await prisma.category.findFirst({
      where: { name: { contains: 'подписк', mode: 'insensitive' } },
    })

    await prisma.transaction.create({
      data: {
        type:        'INCOME',
        amount:      data.amount,
        date:        new Date(),
        categoryId:  subCategory?.id,
        description: `Оплата: ${data.plan || data.description || 'VPN'} — ${data.customer_name || user.email || user.telegramId}`,
        paymentId:   payment.id,
      },
    })

    // Update user LTV
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totalPaid:     { increment: data.amount },
        paymentsCount: { increment: 1 },
        subStatus:     'ACTIVE',
        subExpireAt:   data.subscription_end ? new Date(data.subscription_end) : undefined,
      },
    })

    return { ok: true, paymentId: payment.id }
  })
}
