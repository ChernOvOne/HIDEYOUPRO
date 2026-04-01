import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db'

export async function setupRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  // GET /status — check if setup is done
  app.get('/status', async () => {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
    const setupDone = await prisma.setting.findUnique({ where: { key: 'setup_done' } })

    // Collect which steps are completed
    const steps: Record<string, boolean> = {
      admin_created:   adminCount > 0,
      company_set:     !!(await prisma.setting.findUnique({ where: { key: 'company_name' } })),
      remnawave_set:   !!(await prisma.setting.findUnique({ where: { key: 'remnawave_configured' } })),
      telegram_set:    !!(await prisma.setting.findUnique({ where: { key: 'telegram_configured' } })),
      payment_set:     !!(await prisma.setting.findUnique({ where: { key: 'payment_configured' } })),
      setup_complete:  setupDone?.value === 'true',
    }

    return { needsSetup: adminCount === 0 || setupDone?.value !== 'true', steps }
  })

  // POST /company — step 1: company info
  app.post('/company', admin, async (req) => {
    const body = z.object({
      companyName:   z.string().min(1),
      currency:      z.string().default('RUB'),
      timezone:      z.string().default('Europe/Moscow'),
      supportUrl:    z.string().optional(),
      tgChannel:     z.string().optional(),
    }).parse(req.body)

    const settings = [
      { key: 'company_name',   value: body.companyName },
      { key: 'currency',       value: body.currency },
      { key: 'timezone',       value: body.timezone },
      { key: 'support_url',    value: body.supportUrl || '' },
      { key: 'tg_channel',     value: body.tgChannel || '' },
    ]

    for (const s of settings) {
      await prisma.setting.upsert({
        where:  { key: s.key },
        create: s,
        update: { value: s.value },
      })
    }

    return { ok: true }
  })

  // POST /remnawave — step 2: REMNAWAVE connection
  app.post('/remnawave', admin, async (req) => {
    const body = z.object({
      url:   z.string().url(),
      token: z.string().min(1),
    }).parse(req.body)

    await prisma.setting.upsert({
      where:  { key: 'remnawave_url' },
      create: { key: 'remnawave_url', value: body.url },
      update: { value: body.url },
    })
    await prisma.setting.upsert({
      where:  { key: 'remnawave_token' },
      create: { key: 'remnawave_token', value: body.token },
      update: { value: body.token },
    })
    await prisma.setting.upsert({
      where:  { key: 'remnawave_configured' },
      create: { key: 'remnawave_configured', value: 'true' },
      update: { value: 'true' },
    })

    return { ok: true }
  })

  // POST /telegram — step 3: Telegram bot
  app.post('/telegram', admin, async (req) => {
    const body = z.object({
      botToken: z.string().min(1),
      botName:  z.string().min(1),
    }).parse(req.body)

    await prisma.setting.upsert({
      where:  { key: 'bot_token' },
      create: { key: 'bot_token', value: body.botToken },
      update: { value: body.botToken },
    })
    await prisma.setting.upsert({
      where:  { key: 'bot_name' },
      create: { key: 'bot_name', value: body.botName },
      update: { value: body.botName },
    })
    await prisma.setting.upsert({
      where:  { key: 'telegram_configured' },
      create: { key: 'telegram_configured', value: 'true' },
      update: { value: 'true' },
    })

    return { ok: true }
  })

  // POST /payments — step 4: payment systems
  app.post('/payments', admin, async (req) => {
    const body = z.object({
      yukassaShopId:    z.string().optional(),
      yukassaSecretKey: z.string().optional(),
      cryptopayToken:   z.string().optional(),
    }).parse(req.body)

    if (body.yukassaShopId) {
      await prisma.setting.upsert({
        where:  { key: 'yukassa_shop_id' },
        create: { key: 'yukassa_shop_id', value: body.yukassaShopId },
        update: { value: body.yukassaShopId },
      })
    }
    if (body.yukassaSecretKey) {
      await prisma.setting.upsert({
        where:  { key: 'yukassa_secret_key' },
        create: { key: 'yukassa_secret_key', value: body.yukassaSecretKey },
        update: { value: body.yukassaSecretKey },
      })
    }
    if (body.cryptopayToken) {
      await prisma.setting.upsert({
        where:  { key: 'cryptopay_token' },
        create: { key: 'cryptopay_token', value: body.cryptopayToken },
        update: { value: body.cryptopayToken },
      })
    }

    await prisma.setting.upsert({
      where:  { key: 'payment_configured' },
      create: { key: 'payment_configured', value: 'true' },
      update: { value: 'true' },
    })

    return { ok: true }
  })

  // POST /complete — mark setup as done
  app.post('/complete', admin, async () => {
    await prisma.setting.upsert({
      where:  { key: 'setup_done' },
      create: { key: 'setup_done', value: 'true' },
      update: { value: 'true' },
    })
    return { ok: true }
  })
}
