import { logger } from './logger'

type CronJob = { name: string; interval: number; fn: () => Promise<void>; lastRun?: Date }

class Scheduler {
  private jobs: CronJob[] = []
  private timers: NodeJS.Timeout[] = []
  private running = false

  register(job: CronJob) { this.jobs.push(job) }

  start() {
    if (this.running) return
    this.running = true
    for (const job of this.jobs) {
      const idx = this.jobs.indexOf(job)
      const timer = setTimeout(async () => {
        await this.runJob(job)
        const it = setInterval(() => this.runJob(job), job.interval)
        this.timers.push(it)
      }, 30_000 * (idx + 1))
      this.timers.push(timer)
    }
    logger.info(`Scheduler started with ${this.jobs.length} jobs`)
  }

  stop() { this.timers.forEach(t => clearTimeout(t)); this.timers = []; this.running = false }

  private async runJob(job: CronJob) {
    try { await job.fn(); job.lastRun = new Date() }
    catch (err) { logger.error(`Cron error (${job.name}):`, err) }
  }
}

export const scheduler = new Scheduler()

export async function setupCronJobs() {
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Cron jobs disabled in dev mode')
    return
  }

  // Sync subscriptions every hour
  scheduler.register({
    name: 'sync-subscriptions',
    interval: 60 * 60_000,
    fn: async () => {
      const { syncSubscriptions } = await import('../scripts/sync-subscriptions')
      await syncSubscriptions()
    },
  })

  // Auto-funnels every 15 minutes
  scheduler.register({
    name: 'auto-funnels',
    interval: 15 * 60_000,
    fn: async () => {
      const { runCronFunnels } = await import('../services/funnel-engine')
      await runCronFunnels()
    },
  })

  // Delayed bot blocks every 5 minutes
  scheduler.register({
    name: 'delayed-bot-blocks',
    interval: 5 * 60_000,
    fn: async () => {
      const { getReadyDelayedBlocks } = await import('../bot/state')
      const blocks = await getReadyDelayedBlocks()
      if (!blocks.length) return
      logger.info(`Processing ${blocks.length} delayed bot blocks`)
      // Delayed blocks are handled by bot context — skip for now in scheduler
    },
  })

  // Server payment reminders daily
  scheduler.register({
    name: 'server-reminders',
    interval: 24 * 60 * 60_000,
    fn: async () => {
      const { prisma } = await import('../db')
      const servers = await prisma.server.findMany({
        where: { isActive: true, nextPaymentDate: { not: null } },
      })
      const now = new Date()
      for (const s of servers) {
        if (!s.nextPaymentDate) continue
        const daysUntil = Math.ceil((s.nextPaymentDate.getTime() - now.getTime()) / 86400_000)
        if (daysUntil <= s.notifyDaysBefore && daysUntil >= 0) {
          // Send to notification channels
          const channels = await prisma.notificationChannel.findMany({
            where: { isActive: true, notifyServer: true },
          })
          if (channels.length) {
            const text = `🖥 Сервер "${s.name}" — оплата через ${daysUntil} дн. (${Number(s.monthlyCost)} ${s.currency})`
            const { bot } = await import('../bot/index')
            for (const ch of channels) {
              try { await bot.api.sendMessage(ch.chatId, text) } catch {}
            }
          }
        }
      }
    },
  })

  scheduler.start()
}
