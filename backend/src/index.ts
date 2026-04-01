import Fastify from 'fastify'
import { registerPlugins } from './plugins'
import { registerRoutes }  from './routes'
import { setupCronJobs }   from './utils/scheduler'
import { logger }          from './utils/logger'
import { config, loadDbSettings } from './config'

const app = Fastify({
  logger:     false,
  trustProxy: true,
  bodyLimit:  10 * 1024 * 1024,
})

async function bootstrap() {
  try {
    app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body: string, done) => {
      if (!body || body.trim() === '') { done(null, {}); return }
      try { done(null, JSON.parse(body)) }
      catch (err: any) { err.statusCode = 400; done(err, undefined) }
    })

    // Load settings from DB (tokens, URLs set via Wizard)
    await loadDbSettings()
    logger.info('DB settings loaded')

    // Refresh DB settings every 5 minutes
    setInterval(() => loadDbSettings().catch(() => {}), 5 * 60_000)

    await app.register(import('@fastify/multipart'), { limits: { fileSize: 5 * 1024 * 1024 } })
    await registerPlugins(app)
    await registerRoutes(app)
    await app.listen({ port: config.port, host: '0.0.0.0' })
    logger.info(`HIDEYOU PRO API running on port ${config.port}`)
    logger.info(`Environment: ${config.nodeEnv}`)
    logger.info(`REMNAWAVE: ${config.remnawave.configured ? 'configured' : 'not set'}`)
    logger.info(`Telegram: ${config.telegram.configured ? 'configured' : 'not set'}`)
    await setupCronJobs()
  } catch (err) {
    logger.error('Failed to start server:', err)
    process.exit(1)
  }
}

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down...`)
  await app.close()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

bootstrap()
