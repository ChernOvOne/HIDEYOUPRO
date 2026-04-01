import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db'
import { BotBlockType } from '@prisma/client'

export async function adminBotBlockRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  // ════════════════════════════════════════════════════════════
  //  GROUPS
  // ════════════════════════════════════════════════════════════

  // GET /groups — list all groups with block counts
  app.get('/groups', admin, async () => {
    return prisma.botBlockGroup.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { blocks: true } } },
    })
  })

  // POST /groups — create group
  app.post('/groups', admin, async (req) => {
    const body = z.object({
      name: z.string().min(1),
      icon: z.string().optional(),
      sortOrder: z.number().int().optional(),
    }).parse(req.body)
    return prisma.botBlockGroup.create({ data: body })
  })

  // PUT /groups/:id — update group
  app.put<{ Params: { id: string } }>('/groups/:id', admin, async (req) => {
    const { id } = req.params
    const body = z.object({
      name: z.string().min(1).optional(),
      icon: z.string().nullable().optional(),
      sortOrder: z.number().int().optional(),
    }).parse(req.body)
    return prisma.botBlockGroup.update({ where: { id }, data: body })
  })

  // DELETE /groups/:id — delete group (blocks become ungrouped)
  app.delete<{ Params: { id: string } }>('/groups/:id', admin, async (req) => {
    const { id } = req.params
    await prisma.botBlock.updateMany({ where: { groupId: id }, data: { groupId: null } })
    await prisma.botBlockGroup.delete({ where: { id } })
    return { ok: true }
  })

  // PUT /groups/reorder — reorder groups
  app.put('/groups/reorder', admin, async (req) => {
    const body = z.object({
      ids: z.array(z.string()),
    }).parse(req.body)
    await Promise.all(body.ids.map((id, i) =>
      prisma.botBlockGroup.update({ where: { id }, data: { sortOrder: i } })
    ))
    return { ok: true }
  })

  // ════════════════════════════════════════════════════════════
  //  BLOCKS
  // ════════════════════════════════════════════════════════════

  // GET /blocks — list all blocks (with buttons and triggers)
  app.get('/blocks', admin, async (req) => {
    const qs = z.object({
      groupId: z.string().optional(),
      type: z.string().optional(),
    }).parse(req.query)

    const where: any = {}
    if (qs.groupId) where.groupId = qs.groupId
    if (qs.type) where.type = qs.type as BotBlockType

    return prisma.botBlock.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        buttons: { orderBy: [{ row: 'asc' }, { col: 'asc' }] },
        triggers: true,
        group: true,
      },
    })
  })

  // GET /blocks/:id — single block with all relations
  app.get<{ Params: { id: string } }>('/blocks/:id', admin, async (req) => {
    const { id } = req.params
    return prisma.botBlock.findUniqueOrThrow({
      where: { id },
      include: {
        buttons: { orderBy: [{ row: 'asc' }, { col: 'asc' }] },
        triggers: true,
        group: true,
        stats: { orderBy: { date: 'desc' }, take: 30 },
      },
    })
  })

  // POST /blocks — create block
  app.post('/blocks', admin, async (req) => {
    const body = z.object({
      name: z.string().min(1),
      groupId: z.string().nullable().optional(),
      type: z.nativeEnum(BotBlockType),
      text: z.string().nullable().optional(),
      mediaUrl: z.string().nullable().optional(),
      mediaType: z.string().nullable().optional(),
      parseMode: z.string().optional(),
      pinMessage: z.boolean().optional(),
      deletePrev: z.string().optional(),
      replyKeyboard: z.any().optional(),
      removeReplyKb: z.boolean().optional(),
      conditionType: z.string().nullable().optional(),
      conditionValue: z.string().nullable().optional(),
      nextBlockTrue: z.string().nullable().optional(),
      nextBlockFalse: z.string().nullable().optional(),
      actionType: z.string().nullable().optional(),
      actionValue: z.string().nullable().optional(),
      nextBlockId: z.string().nullable().optional(),
      inputPrompt: z.string().nullable().optional(),
      inputVar: z.string().nullable().optional(),
      inputValidation: z.string().nullable().optional(),
      delayMinutes: z.number().int().nullable().optional(),
      splitVariants: z.any().optional(),
      redirectBlockId: z.string().nullable().optional(),
      reactionEmoji: z.string().nullable().optional(),
      notifyAdminText: z.string().nullable().optional(),
      httpMethod: z.string().nullable().optional(),
      httpUrl: z.string().nullable().optional(),
      httpHeaders: z.any().optional(),
      httpBody: z.string().nullable().optional(),
      httpSaveVar: z.string().nullable().optional(),
      throttleMinutes: z.number().int().nullable().optional(),
      scheduleStart: z.string().nullable().optional(),
      scheduleEnd: z.string().nullable().optional(),
      scheduleDays: z.any().optional(),
      scheduleBlockId: z.string().nullable().optional(),
      isDraft: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    }).parse(req.body)

    return prisma.botBlock.create({
      data: body as any,
      include: { buttons: true, triggers: true },
    })
  })

  // PUT /blocks/:id — update block
  app.put<{ Params: { id: string } }>('/blocks/:id', admin, async (req) => {
    const { id } = req.params
    const body = z.object({
      name: z.string().min(1).optional(),
      groupId: z.string().nullable().optional(),
      type: z.nativeEnum(BotBlockType).optional(),
      text: z.string().nullable().optional(),
      mediaUrl: z.string().nullable().optional(),
      mediaType: z.string().nullable().optional(),
      parseMode: z.string().optional(),
      pinMessage: z.boolean().optional(),
      deletePrev: z.string().optional(),
      replyKeyboard: z.any().optional(),
      removeReplyKb: z.boolean().optional(),
      conditionType: z.string().nullable().optional(),
      conditionValue: z.string().nullable().optional(),
      nextBlockTrue: z.string().nullable().optional(),
      nextBlockFalse: z.string().nullable().optional(),
      actionType: z.string().nullable().optional(),
      actionValue: z.string().nullable().optional(),
      nextBlockId: z.string().nullable().optional(),
      inputPrompt: z.string().nullable().optional(),
      inputVar: z.string().nullable().optional(),
      inputValidation: z.string().nullable().optional(),
      delayMinutes: z.number().int().nullable().optional(),
      splitVariants: z.any().optional(),
      redirectBlockId: z.string().nullable().optional(),
      reactionEmoji: z.string().nullable().optional(),
      notifyAdminText: z.string().nullable().optional(),
      httpMethod: z.string().nullable().optional(),
      httpUrl: z.string().nullable().optional(),
      httpHeaders: z.any().optional(),
      httpBody: z.string().nullable().optional(),
      httpSaveVar: z.string().nullable().optional(),
      throttleMinutes: z.number().int().nullable().optional(),
      scheduleStart: z.string().nullable().optional(),
      scheduleEnd: z.string().nullable().optional(),
      scheduleDays: z.any().optional(),
      scheduleBlockId: z.string().nullable().optional(),
      isDraft: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    }).parse(req.body)

    return prisma.botBlock.update({
      where: { id },
      data: body as any,
      include: { buttons: true, triggers: true },
    })
  })

  // PUT /blocks/:id/publish — publish draft
  app.put<{ Params: { id: string } }>('/blocks/:id/publish', admin, async (req) => {
    const { id } = req.params
    return prisma.botBlock.update({
      where: { id },
      data: { isDraft: false, publishedAt: new Date(), version: { increment: 1 } },
    })
  })

  // DELETE /blocks/:id
  app.delete<{ Params: { id: string } }>('/blocks/:id', admin, async (req) => {
    const { id } = req.params
    await prisma.botBlock.delete({ where: { id } })
    return { ok: true }
  })

  // PUT /blocks/reorder — reorder blocks
  app.put('/blocks/reorder', admin, async (req) => {
    const body = z.object({
      ids: z.array(z.string()),
    }).parse(req.body)
    await Promise.all(body.ids.map((id, i) =>
      prisma.botBlock.update({ where: { id }, data: { sortOrder: i } })
    ))
    return { ok: true }
  })

  // ════════════════════════════════════════════════════════════
  //  BUTTONS
  // ════════════════════════════════════════════════════════════

  // POST /blocks/:blockId/buttons — add button
  app.post<{ Params: { blockId: string } }>('/blocks/:blockId/buttons', admin, async (req) => {
    const { blockId } = req.params
    const body = z.object({
      label: z.string().min(1),
      type: z.string(),
      nextBlockId: z.string().nullable().optional(),
      url: z.string().nullable().optional(),
      row: z.number().int().optional(),
      col: z.number().int().optional(),
    }).parse(req.body)

    return prisma.botButton.create({
      data: { blockId, ...body },
    })
  })

  // PUT /buttons/:id — update button
  app.put<{ Params: { id: string } }>('/buttons/:id', admin, async (req) => {
    const { id } = req.params
    const body = z.object({
      label: z.string().min(1).optional(),
      type: z.string().optional(),
      nextBlockId: z.string().nullable().optional(),
      url: z.string().nullable().optional(),
      row: z.number().int().optional(),
      col: z.number().int().optional(),
      sortOrder: z.number().int().optional(),
    }).parse(req.body)
    return prisma.botButton.update({ where: { id }, data: body })
  })

  // DELETE /buttons/:id
  app.delete<{ Params: { id: string } }>('/buttons/:id', admin, async (req) => {
    const { id } = req.params
    await prisma.botButton.delete({ where: { id } })
    return { ok: true }
  })

  // PUT /blocks/:blockId/buttons/reorder — reorder buttons
  app.put<{ Params: { blockId: string } }>('/blocks/:blockId/buttons/reorder', admin, async (req) => {
    const { blockId } = req.params
    const body = z.object({
      buttons: z.array(z.object({ id: z.string(), row: z.number().int(), col: z.number().int() })),
    }).parse(req.body)
    await Promise.all(body.buttons.map(b =>
      prisma.botButton.update({ where: { id: b.id }, data: { row: b.row, col: b.col } })
    ))
    return { ok: true }
  })

  // ════════════════════════════════════════════════════════════
  //  TRIGGERS
  // ════════════════════════════════════════════════════════════

  // GET /triggers — list all triggers
  app.get('/triggers', admin, async () => {
    return prisma.botTrigger.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: { block: { select: { id: true, name: true, type: true } } },
    })
  })

  // POST /triggers — create trigger
  app.post('/triggers', admin, async (req) => {
    const body = z.object({
      type: z.string(),
      value: z.string().min(1),
      blockId: z.string(),
      priority: z.number().int().optional(),
    }).parse(req.body)
    return prisma.botTrigger.create({
      data: body,
      include: { block: { select: { id: true, name: true, type: true } } },
    })
  })

  // PUT /triggers/:id — update trigger
  app.put<{ Params: { id: string } }>('/triggers/:id', admin, async (req) => {
    const { id } = req.params
    const body = z.object({
      type: z.string().optional(),
      value: z.string().min(1).optional(),
      blockId: z.string().optional(),
      priority: z.number().int().optional(),
    }).parse(req.body)
    return prisma.botTrigger.update({ where: { id }, data: body })
  })

  // DELETE /triggers/:id
  app.delete<{ Params: { id: string } }>('/triggers/:id', admin, async (req) => {
    const { id } = req.params
    await prisma.botTrigger.delete({ where: { id } })
    return { ok: true }
  })

  // ════════════════════════════════════════════════════════════
  //  STATS
  // ════════════════════════════════════════════════════════════

  // GET /stats — overall block stats
  app.get('/stats', admin, async () => {
    const [totalBlocks, totalGroups, totalTriggers, totalButtons] = await Promise.all([
      prisma.botBlock.count(),
      prisma.botBlockGroup.count(),
      prisma.botTrigger.count(),
      prisma.botButton.count(),
    ])
    // Top blocks by views (last 30 days)
    const topBlocks = await prisma.botBlockStat.groupBy({
      by: ['blockId'],
      _sum: { views: true, clicks: true },
      orderBy: { _sum: { views: 'desc' } },
      take: 10,
    })
    return { totalBlocks, totalGroups, totalTriggers, totalButtons, topBlocks }
  })

  // ════════════════════════════════════════════════════════════
  //  BLOCK LIST (for dropdowns — minimal data)
  // ════════════════════════════════════════════════════════════

  // GET /blocks-list — lightweight list for selects/dropdowns
  app.get('/blocks-list', admin, async () => {
    return prisma.botBlock.findMany({
      select: { id: true, name: true, type: true, groupId: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  })
}
