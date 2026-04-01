import type { FastifyInstance } from 'fastify'
import { authRoutes }           from './auth'
import { adminRoutes }          from './admin'
import { setupRoutes }          from './setup'
import { adminUserRoutes }      from './admin-users'
import { adminAccountingRoutes } from './admin-accounting'
import { adminPartnerRoutes }   from './admin-partners'
import { adminServerRoutes }    from './admin-servers'
import { adminMarketingRoutes } from './admin-marketing'

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    status:    'ok',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()),
  }))

  // Auth
  await app.register(authRoutes, { prefix: '/api/auth' })

  // Setup wizard
  await app.register(setupRoutes, { prefix: '/api/setup' })

  // Admin
  await app.register(adminRoutes,           { prefix: '/api/admin' })
  await app.register(adminUserRoutes,       { prefix: '/api/admin/users' })
  await app.register(adminAccountingRoutes, { prefix: '/api/admin/accounting' })
  await app.register(adminPartnerRoutes,    { prefix: '/api/admin/partners' })
  await app.register(adminServerRoutes,     { prefix: '/api/admin/servers' })
  await app.register(adminMarketingRoutes,  { prefix: '/api/admin/marketing' })

  // Uploads
  app.register(import('@fastify/static'), { root: '/app/uploads', prefix: '/uploads/', decorateReply: false })
}
