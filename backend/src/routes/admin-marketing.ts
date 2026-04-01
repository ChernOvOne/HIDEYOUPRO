import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db'
import { randomBytes } from 'crypto'

export async function adminMarketingRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  // ── Ad Campaigns ──────────────────────────────────────────
  app.get('/campaigns', admin, async (req) => {
    const qs = z.object({
      dateFrom: z.string().optional(),
      dateTo:   z.string().optional(),
    }).parse(req.query)

    const where: any = {}
    if (qs.dateFrom || qs.dateTo) {
      where.date = {}
      if (qs.dateFrom) where.date.gte = new Date(qs.dateFrom)
      if (qs.dateTo)   where.date.lte = new Date(qs.dateTo)
    }

    const campaigns = await prisma.adCampaign.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        investorPartner: { select: { id: true, name: true } },
        _count: { select: { utmClicks: true, utmLeads: true } },
      },
    })

    return campaigns.map(c => ({
      ...c,
      cps: c.subscribersGained > 0 ? Number(c.amount) / c.subscribersGained : 0,
      clicks: c._count.utmClicks,
      leads:  c._count.utmLeads,
    }))
  })

  app.post('/campaigns', admin, async (req) => {
    const body = z.object({
      date:              z.string(),
      channelName:       z.string().min(1),
      channelUrl:        z.string().optional(),
      format:            z.string().optional(),
      amount:            z.number().min(0),
      subscribersGained: z.number().int().default(0),
      notes:             z.string().optional(),
      budgetSource:      z.enum(['account', 'investment']).default('account'),
      investorPartnerId: z.string().nullable().optional(),
      targetUrl:         z.string().optional(),
      targetType:        z.string().optional(),
    }).parse(req.body)

    const utmCode = `ad_${randomBytes(4).toString('hex')}`

    return prisma.adCampaign.create({
      data: {
        ...body,
        date: new Date(body.date),
        utmCode,
        investorPartnerId: body.investorPartnerId || undefined,
      } as any,
    })
  })

  app.put<{ Params: { id: string } }>('/campaigns/:id', admin, async (req) => {
    const body = z.object({
      channelName:       z.string().optional(),
      channelUrl:        z.string().optional(),
      format:            z.string().optional(),
      amount:            z.number().optional(),
      subscribersGained: z.number().int().optional(),
      notes:             z.string().optional(),
      budgetSource:      z.string().optional(),
      investorPartnerId: z.string().nullable().optional(),
    }).parse(req.body)
    return prisma.adCampaign.update({
      where: { id: req.params.id },
      data: { ...body, investorPartnerId: body.investorPartnerId || undefined } as any,
    })
  })

  app.delete<{ Params: { id: string } }>('/campaigns/:id', admin, async (req) => {
    await prisma.adCampaign.delete({ where: { id: req.params.id } })
    return { ok: true }
  })

  // ── UTM Stats ─────────────────────────────────────────────
  app.get('/utm/summary', admin, async () => {
    const campaigns = await prisma.adCampaign.findMany({
      where: { utmCode: { not: null } },
      select: {
        id: true, utmCode: true, channelName: true, amount: true, subscribersGained: true,
        _count: { select: { utmClicks: true, utmLeads: true } },
      },
    })

    const converted = await prisma.utmLead.groupBy({
      by: ['utmCode'],
      where: { converted: true },
      _count: true,
    })
    const convMap = new Map(converted.map(c => [c.utmCode, c._count]))

    return campaigns.map(c => ({
      ...c,
      clicks:     c._count.utmClicks,
      leads:      c._count.utmLeads,
      conversions: convMap.get(c.utmCode!) || 0,
      cps: c.subscribersGained > 0 ? Number(c.amount) / c.subscribersGained : 0,
    }))
  })

  // ── Funnel ────────────────────────────────────────────────
  app.get('/funnel', admin, async () => {
    const totalClicks = await prisma.utmClick.count()
    const totalLeads  = await prisma.utmLead.count()
    const totalConv   = await prisma.utmLead.count({ where: { converted: true } })
    const totalSpend  = await prisma.adCampaign.aggregate({ _sum: { amount: true } })

    return {
      clicks:      totalClicks,
      leads:       totalLeads,
      conversions: totalConv,
      totalSpend:  Number(totalSpend._sum.amount || 0),
      clickToLead: totalClicks > 0 ? ((totalLeads / totalClicks) * 100).toFixed(1) : '0',
      leadToConv:  totalLeads > 0 ? ((totalConv / totalLeads) * 100).toFixed(1) : '0',
    }
  })
}
