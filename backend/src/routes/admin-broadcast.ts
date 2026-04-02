import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db'
import { bot } from '../bot/index'
import { logger } from '../utils/logger'

export async function adminBroadcastRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  // GET / — list broadcasts
  app.get('/', admin, async (req) => {
    const qs = z.object({
      status: z.string().optional(),
      page:   z.coerce.number().int().min(1).default(1),
      limit:  z.coerce.number().int().min(1).max(50).default(20),
    }).parse(req.query)

    const where: any = {}
    if (qs.status) where.status = qs.status

    const [broadcasts, total] = await Promise.all([
      prisma.broadcast.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (qs.page - 1) * qs.limit,
        take: qs.limit,
      }),
      prisma.broadcast.count({ where }),
    ])

    return { broadcasts, total }
  })

  // POST / — create broadcast
  app.post('/', admin, async (req) => {
    const body = z.object({
      name:          z.string().min(1),
      channelTg:     z.boolean().default(false),
      channelEmail:  z.boolean().default(false),
      tgText:        z.string().optional(),
      tgParseMode:   z.string().default('Markdown'),
      tgButtons:     z.any().optional(),
      tgMediaUrl:    z.string().optional(),
      tgMediaType:   z.string().optional(),
      tgPollQuestion:z.string().optional(),
      tgPollOptions: z.any().optional(),
      tgPollAnon:    z.boolean().default(true),
      tgPollMulti:   z.boolean().default(false),
      emailSubject:  z.string().optional(),
      emailHtml:     z.string().optional(),
      emailTemplate: z.string().default('dark'),
      audienceType:  z.string().default('all'),
      audienceValue: z.string().optional(),
      scheduledAt:   z.string().optional(),
    }).parse(req.body)

    return prisma.broadcast.create({
      data: {
        ...body,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        status: body.scheduledAt ? 'SCHEDULED' : 'DRAFT',
      } as any,
    })
  })

  // PUT /:id — update broadcast
  app.put<{ Params: { id: string } }>('/:id', admin, async (req) => {
    const body = z.object({
      name:          z.string().optional(),
      channelTg:     z.boolean().optional(),
      channelEmail:  z.boolean().optional(),
      tgText:        z.string().optional(),
      tgParseMode:   z.string().optional(),
      tgButtons:     z.any().optional(),
      tgMediaUrl:    z.string().nullable().optional(),
      tgMediaType:   z.string().nullable().optional(),
      tgPollQuestion:z.string().nullable().optional(),
      tgPollOptions: z.any().optional(),
      tgPollAnon:    z.boolean().optional(),
      tgPollMulti:   z.boolean().optional(),
      emailSubject:  z.string().optional(),
      emailHtml:     z.string().optional(),
      emailTemplate: z.string().optional(),
      audienceType:  z.string().optional(),
      audienceValue: z.string().nullable().optional(),
    }).parse(req.body)

    return prisma.broadcast.update({ where: { id: req.params.id }, data: body as any })
  })

  // DELETE /:id
  app.delete<{ Params: { id: string } }>('/:id', admin, async (req) => {
    await prisma.broadcast.delete({ where: { id: req.params.id } })
    return { ok: true }
  })

  // POST /:id/send — execute broadcast
  app.post<{ Params: { id: string } }>('/:id/send', admin, async (req) => {
    // Atomic status check + update to prevent double-send race condition
    const updated = await prisma.broadcast.updateMany({
      where: { id: req.params.id, status: { notIn: ['SENDING', 'COMPLETED'] } },
      data:  { status: 'SENDING' },
    })
    if (updated.count === 0) {
      return { error: 'Already sent or sending' }
    }

    const broadcast = await prisma.broadcast.findUniqueOrThrow({ where: { id: req.params.id } })

    // Get audience
    const audienceWhere: any = { isActive: true }
    switch (broadcast.audienceType) {
      case 'active':   audienceWhere.subStatus = 'ACTIVE'; break
      case 'inactive': audienceWhere.subStatus = 'INACTIVE'; break
      case 'expired':  audienceWhere.subStatus = 'EXPIRED'; break
      case 'trial':    audienceWhere.subStatus = 'TRIAL'; break
    }

    const users = await prisma.user.findMany({
      where: audienceWhere,
      select: { id: true, telegramId: true, email: true },
    })

    let sentCount = 0
    let failCount = 0
    const BATCH_SIZE = 25

    // Helper: process array in parallel batches
    async function sendInBatches<T>(items: T[], fn: (item: T) => Promise<void>) {
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE)
        const results = await Promise.allSettled(batch.map(fn))
        for (const r of results) {
          if (r.status === 'fulfilled') sentCount++
          else failCount++
        }
      }
    }

    // Send TG
    if (broadcast.channelTg && broadcast.tgText) {
      const tgUsers = users.filter(u => u.telegramId)
      await sendInBatches(tgUsers, async (user) => {
        if (broadcast.tgPollQuestion && broadcast.tgPollOptions) {
          const options = broadcast.tgPollOptions as string[]
          await bot.api.sendMessage(user.telegramId!, `📊 ${broadcast.tgPollQuestion}\n\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`)
        } else {
          const opts: any = { parse_mode: broadcast.tgParseMode || 'Markdown' }
          if (broadcast.tgButtons) {
            const buttons = broadcast.tgButtons as any[]
            if (buttons.length > 0) {
              opts.reply_markup = {
                inline_keyboard: buttons.map((btn: any) => [{
                  text: btn.label || btn.text,
                  ...(btn.url ? { url: btn.url } : {}),
                  ...(btn.data ? { callback_data: btn.data } : {}),
                }]),
              }
            }
          }
          await bot.api.sendMessage(user.telegramId!, broadcast.tgText!, opts)
        }
      })
    }

    // Send Email
    if (broadcast.channelEmail && broadcast.emailSubject) {
      const { emailService } = await import('../services/email')
      const emailUsers = users.filter(u => u.email)
      await sendInBatches(emailUsers, async (user) => {
        await emailService.sendBroadcastEmail({
          to: user.email!,
          subject: broadcast.emailSubject!,
          html: broadcast.emailHtml || '',
        })
      })
    }

    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { status: 'COMPLETED', sentAt: new Date(), sentCount, failCount },
    })

    return { ok: true, sentCount, failCount }
  })
}
