import type { FastifyInstance } from 'fastify'
import { authRoutes }    from './auth'
import { adminRoutes }   from './admin'
import { setupRoutes }   from './setup'

export async function registerRoutes(app: FastifyInstance) {
  // Health check
  app.get('/health', async () => ({
    status:    'ok',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()),
  }))

  // Auth
  await app.register(authRoutes, { prefix: '/api/auth' })

  // Setup wizard (first-time configuration)
  await app.register(setupRoutes, { prefix: '/api/setup' })

  // Admin
  await app.register(adminRoutes, { prefix: '/api/admin' })

  // Serve uploads
  app.register(import('@fastify/static'), { root: '/app/uploads', prefix: '/uploads/', decorateReply: false })
}
