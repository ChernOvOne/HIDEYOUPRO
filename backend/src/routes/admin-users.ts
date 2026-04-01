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
    return user
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

  // POST /:id/reset-password — set new password
  app.post<{ Params: { id: string } }>('/:id/reset-password', { preHandler: [app.adminStrict] }, async (req) => {
    const { id } = req.params
    const body = z.object({ password: z.string().min(6) }).parse(req.body)
    const passwordHash = await bcrypt.hash(body.password, 12)
    await prisma.user.update({ where: { id }, data: { passwordHash } })
    return { ok: true }
  })
}
