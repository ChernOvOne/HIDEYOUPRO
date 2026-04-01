import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../db'
import { config } from '../config'

export async function authRoutes(app: FastifyInstance) {
  // POST /login — email + password
  app.post('/login', async (req, reply) => {
    const body = z.object({
      email:    z.string().min(1),
      password: z.string().min(1),
    }).parse(req.body)

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: body.email.toLowerCase() },
          { telegramName: body.email },
        ],
        isActive: true,
      },
    })

    if (!user?.passwordHash) {
      return reply.status(401).send({ error: 'Неверный логин или пароль' })
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash)
    if (!valid) {
      return reply.status(401).send({ error: 'Неверный логин или пароль' })
    }

    // Sync REMNAWAVE if not linked yet
    if (!user.remnawaveUuid) {
      try {
        const { remnawave } = await import('../services/remnawave')
        if (remnawave.configured) {
          const rm = user.telegramId
            ? await remnawave.getUserByTelegramId(user.telegramId).catch(() => null)
            : user.email
              ? await remnawave.getUserByEmail(user.email).catch(() => null)
              : null
          if (rm) {
            const statusMap: Record<string, string> = { ACTIVE: 'ACTIVE', DISABLED: 'INACTIVE', LIMITED: 'ACTIVE', EXPIRED: 'EXPIRED' }
            await prisma.user.update({
              where: { id: user.id },
              data: {
                remnawaveUuid: rm.uuid,
                subStatus: (statusMap[rm.status] ?? 'INACTIVE') as any,
                subExpireAt: rm.expireAt ? new Date(rm.expireAt) : null,
                subLink: remnawave.getSubscriptionUrl(rm.uuid, rm.subscriptionUrl),
              },
            })
          }
        }
      } catch {}
    }

    await prisma.user.update({
      where: { id: user.id },
      data:  { lastLoginAt: new Date(), lastIp: req.ip },
    })

    const token = app.jwt.sign({
      id:   user.id,
      sub:  user.id,
      role: user.role,
    })

    reply.setCookie('token', token, {
      path:     '/',
      httpOnly: true,
      secure:   config.isProd,
      sameSite: 'lax',
      domain:   config.cookieDomain,
      maxAge:   30 * 24 * 60 * 60,
    })

    return {
      user: {
        id:           user.id,
        email:        user.email,
        telegramName: user.telegramName,
        role:         user.role,
      },
      token,
    }
  })

  // POST /register — first admin registration (only if no admins exist)
  app.post('/register', async (req, reply) => {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
    if (adminCount > 0) {
      return reply.status(403).send({ error: 'Регистрация закрыта. Используйте приглашение.' })
    }

    const body = z.object({
      email:    z.string().email(),
      password: z.string().min(6),
      name:     z.string().min(1).optional(),
    }).parse(req.body)

    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } })
    if (existing) return reply.status(409).send({ error: 'Email уже используется' })

    const passwordHash = await bcrypt.hash(body.password, 12)
    const user = await prisma.user.create({
      data: {
        email:        body.email.toLowerCase(),
        emailVerified: true,
        passwordHash,
        telegramName: body.name || body.email.split('@')[0],
        role:         'ADMIN',
      },
    })

    const token = app.jwt.sign({ id: user.id, sub: user.id, role: user.role })

    reply.setCookie('token', token, {
      path: '/', httpOnly: true, secure: config.isProd,
      sameSite: 'lax', domain: config.cookieDomain,
      maxAge: 30 * 24 * 60 * 60,
    })

    return { user: { id: user.id, email: user.email, role: user.role }, token }
  })

  // GET /me
  app.get('/me', { preHandler: [app.authenticate] }, async (req) => {
    const { id } = req.user as any
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, telegramId: true, telegramName: true,
        role: true, isActive: true, balance: true, bonusDays: true,
        subStatus: true, subExpireAt: true, referralCode: true,
        createdAt: true, lastLoginAt: true,
      },
    })
    if (!user) return { error: 'Not found' }

    // Check if setup wizard is completed
    const setupDone = await prisma.setting.findUnique({ where: { key: 'setup_done' } })

    return { ...user, setupDone: setupDone?.value === 'true' }
  })

  // POST /logout
  app.post('/logout', async (req, reply) => {
    reply.clearCookie('token', {
      path: '/', domain: config.cookieDomain,
    })
    return { ok: true }
  })
}
