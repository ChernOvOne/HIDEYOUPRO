import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db'
import bcrypt from 'bcryptjs'

export async function adminUserRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  // GET / — list users with search, filters, pagination
  app.get('/', admin, async (req) => {
    const qs = z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      page:   z.coerce.number().int().min(1).default(1),
      limit:  z.coerce.number().int().min(1).max(100).default(20),
    }).parse(req.query)

    const where: any = {}
    if (qs.search) {
      where.OR = [
        { email:        { contains: qs.search, mode: 'insensitive' } },
        { telegramName: { contains: qs.search, mode: 'insensitive' } },
        { telegramId:   { contains: qs.search, mode: 'insensitive' } },
        { referralCode: { contains: qs.search, mode: 'insensitive' } },
      ]
    }
    if (qs.status === 'active')   where.subStatus = 'ACTIVE'
    if (qs.status === 'inactive') where.subStatus = 'INACTIVE'
    if (qs.status === 'expired')  where.subStatus = 'EXPIRED'

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, telegramId: true, telegramName: true,
          role: true, isActive: true, subStatus: true, subExpireAt: true,
          balance: true, bonusDays: true, totalPaid: true, paymentsCount: true,
          utmCode: true, referralCode: true, createdAt: true, lastLoginAt: true,
          _count: { select: { referrals: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (qs.page - 1) * qs.limit,
        take: qs.limit,
      }),
      prisma.user.count({ where }),
    ])

    // CSV export
    if ((req.query as any).export === 'csv') {
      const allUsers = await prisma.user.findMany({
        where,
        select: {
          id: true, email: true, telegramId: true, telegramName: true,
          subStatus: true, subExpireAt: true, balance: true, totalPaid: true,
          utmCode: true, referralCode: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      const header = 'id,email,telegramId,telegramName,status,expireAt,balance,totalPaid,utm,refCode,createdAt'
      const rows = allUsers.map(u =>
        [u.id, u.email || '', u.telegramId || '', u.telegramName || '', u.subStatus, u.subExpireAt?.toISOString() || '', Number(u.balance), Number(u.totalPaid), u.utmCode || '', u.referralCode || '', u.createdAt.toISOString()].join(',')
      )
      return { csv: header + '\n' + rows.join('\n'), total: allUsers.length }
    }

    return { users, total, page: qs.page, pages: Math.ceil(total / qs.limit) }
  })

  // GET /:id — user detail with all relations
  app.get<{ Params: { id: string } }>('/:id', admin, async (req) => {
    const { id } = req.params
    const user = await prisma.user.findUniqueOrThrow({
      where: { id },
      include: {
        payments:       { orderBy: { createdAt: 'desc' }, take: 20 },
        bonusHistory:   { orderBy: { appliedAt: 'desc' }, take: 10 },
        referrals:      { select: { id: true, email: true, telegramName: true, totalPaid: true, createdAt: true }, take: 20 },
        adminNotesOnUser: { include: { author: { select: { telegramName: true } } }, orderBy: { createdAt: 'desc' } },
        userTags:       true,
        userVariables:  true,
        balanceTransactions: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { referrals: true, payments: true } },
      },
    })

    // Enrich with REMNAWAVE data
    let rmData = null
    if (user.remnawaveUuid) {
      try {
        const { remnawave } = await import('../services/remnawave')
        rmData = await remnawave.getUserByUuid(user.remnawaveUuid)
      } catch {}
    }

    return { ...user, rmData }
  })

  // PUT /:id — update user
  app.put<{ Params: { id: string } }>('/:id', admin, async (req) => {
    const { id } = req.params
    const body = z.object({
      email:        z.string().email().optional(),
      telegramName: z.string().optional(),
      role:         z.enum(['USER', 'ADMIN', 'EDITOR', 'INVESTOR']).optional(),
      isActive:     z.boolean().optional(),
      balance:      z.number().optional(),
      bonusDays:    z.number().int().optional(),
      notes:        z.string().optional(),
      utmCode:      z.string().optional(),
    }).parse(req.body)

    return prisma.user.update({ where: { id }, data: body as any })
  })

  // POST /:id/note — add admin note
  app.post<{ Params: { id: string } }>('/:id/note', admin, async (req) => {
    const { id } = req.params
    const body = z.object({ note: z.string().min(1) }).parse(req.body)
    const authorId = (req.user as any).id

    return prisma.adminNote.create({
      data: { userId: id, authorId, note: body.note },
    })
  })

  // POST /:id/add-days — extend subscription
  app.post<{ Params: { id: string } }>('/:id/add-days', admin, async (req) => {
    const { id } = req.params
    const body = z.object({ days: z.number().int().min(1) }).parse(req.body)

    const user = await prisma.user.findUniqueOrThrow({ where: { id } })
    const baseDate = user.subExpireAt && user.subExpireAt > new Date() ? user.subExpireAt : new Date()
    const newExpire = new Date(baseDate.getTime() + body.days * 86400_000)

    await prisma.user.update({
      where: { id },
      data: { subExpireAt: newExpire, subStatus: 'ACTIVE' },
    })

    return { ok: true, newExpireAt: newExpire.toISOString() }
  })

  // POST /:id/toggle — toggle active status
  app.post<{ Params: { id: string } }>('/:id/toggle', admin, async (req) => {
    const { id } = req.params
    const user = await prisma.user.findUniqueOrThrow({ where: { id } })
    await prisma.user.update({ where: { id }, data: { isActive: !user.isActive } })
    return { ok: true, isActive: !user.isActive }
  })

  // DELETE /:id
  app.delete<{ Params: { id: string } }>('/:id', { preHandler: [app.adminStrict] }, async (req) => {
    const { id } = req.params
    await prisma.user.delete({ where: { id } })
    return { ok: true }
  })

  // POST /:id/revoke — refresh subscription URL
  app.post<{ Params: { id: string } }>('/:id/revoke', admin, async (req) => {
    const { id } = req.params
    const user = await prisma.user.findUniqueOrThrow({ where: { id } })
    if (user.remnawaveUuid) {
      const { remnawave } = await import('../services/remnawave')
      await remnawave.revokeSubscription(user.remnawaveUuid)
    }
    return { ok: true }
  })

  // POST /:id/reset-traffic — reset user traffic
  app.post<{ Params: { id: string } }>('/:id/reset-traffic', admin, async (req) => {
    const { id } = req.params
    const user = await prisma.user.findUniqueOrThrow({ where: { id } })
    if (user.remnawaveUuid) {
      const { remnawave } = await import('../services/remnawave')
      const cfg = await (remnawave as any).getConfig()
      const axios = (await import('axios')).default
      await axios.post(`/users/${user.remnawaveUuid}/reset-traffic`, {}, cfg)
    }
    return { ok: true }
  })

  // POST /:id/notify — send notification to user
  app.post<{ Params: { id: string } }>('/:id/notify', admin, async (req) => {
    const { id } = req.params
    const body = z.object({ title: z.string(), message: z.string() }).parse(req.body)
    const user = await prisma.user.findUniqueOrThrow({ where: { id } })
    if (user.telegramId) {
      const { bot } = await import('../bot/index')
      const text = body.title ? `*${body.title}*\n\n${body.message}` : body.message
      await bot.api.sendMessage(user.telegramId, text, { parse_mode: 'Markdown' })
    }
    return { ok: true }
  })

  // DELETE /:id/devices/:hwid — delete device
  app.delete<{ Params: { id: string; hwid: string } }>('/:id/devices/:hwid', admin, async (req) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } })
    if (user.remnawaveUuid) {
      const { remnawave } = await import('../services/remnawave')
      await remnawave.deleteDevice(user.remnawaveUuid, req.params.hwid)
    }
    return { ok: true }
  })

  // GET /:id/activity — user activity history
  app.get<{ Params: { id: string } }>('/:id/activity', admin, async (req) => {
    const { id } = req.params
    const [payments, balanceTx, bonuses] = await Promise.all([
      prisma.payment.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.balanceTransaction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.referralBonus.findMany({ where: { referrerId: id }, orderBy: { appliedAt: 'desc' }, take: 50 }),
    ])

    const items: any[] = []
    for (const p of payments) {
      items.push({ id: p.id, type: 'payment', description: `${p.provider} — ${p.purpose}`, amount: Number(p.amount), currency: p.currency, date: p.createdAt, status: p.status })
    }
    for (const t of balanceTx) {
      items.push({ id: t.id, type: 'balance', description: t.description, amount: Number(t.amount), currency: 'RUB', date: t.createdAt, status: 'completed' })
    }
    for (const b of bonuses) {
      items.push({ id: b.id, type: 'bonus_redeem', description: `+${b.bonusDays} дней`, amount: b.bonusDays, date: b.appliedAt, status: 'completed' })
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return { items }
  })

  // POST /:id/reset-password — set new password
  app.post<{ Params: { id: string } }>('/:id/reset-password', { preHandler: [app.adminStrict] }, async (req) => {
    const { id } = req.params
    const body = z.object({ password: z.string().min(6) }).parse(req.body)
    const passwordHash = await bcrypt.hash(body.password, 12)
    await prisma.user.update({ where: { id }, data: { passwordHash } })
    return { ok: true }
  })
}
