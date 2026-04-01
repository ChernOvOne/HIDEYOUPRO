import type { FastifyInstance } from 'fastify'
import { authRoutes }             from './auth'
import { adminRoutes }            from './admin'
import { setupRoutes }            from './setup'
import { adminUserRoutes }        from './admin-users'
import { adminAccountingRoutes }  from './admin-accounting'
import { adminPartnerRoutes }     from './admin-partners'
import { adminServerRoutes }      from './admin-servers'
import { adminMarketingRoutes }   from './admin-marketing'
import { adminTariffRoutes }      from './admin-tariffs'
import { adminPaymentRoutes, paymentWebhookRoutes } from './admin-payments'
import { adminFunnelRoutes }      from './admin-funnels'
import { adminBroadcastRoutes }   from './admin-broadcast'
import { adminBotBlockRoutes }    from './admin-bot-blocks'
import { adminAnalyticsRoutes }   from './admin-analytics'
import { adminReportRoutes }      from './admin-reports'
import { userRoutes }             from './users'
import { tariffRoutes }           from './tariffs'
import { paymentRoutes }          from './payments'
import { webhookRoutes }          from './webhooks'
import { publicRoutes }           from './public'
import { giftRoutes }             from './gifts'
import { verificationRoutes }     from './verification'
import { userPromoRoutes }        from './promo'

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

  // Public
  await app.register(publicRoutes, { prefix: '/api/public' })

  // User-facing
  await app.register(userRoutes,        { prefix: '/api/user' })
  await app.register(tariffRoutes,      { prefix: '/api/tariffs' })
  await app.register(paymentRoutes,     { prefix: '/api/payments/user' })
  await app.register(giftRoutes,        { prefix: '/api/gifts' })
  await app.register(verificationRoutes,{ prefix: '/api/verification' })
  await app.register(userPromoRoutes,   { prefix: '/api/user/promo' })

  // Webhooks
  await app.register(webhookRoutes,      { prefix: '/api/webhooks' })
  await app.register(paymentWebhookRoutes, { prefix: '/api/payments' })

  // Admin core
  await app.register(adminRoutes,            { prefix: '/api/admin' })
  await app.register(adminUserRoutes,        { prefix: '/api/admin/users' })
  await app.register(adminTariffRoutes,      { prefix: '/api/admin/tariffs' })
  await app.register(adminPaymentRoutes,     { prefix: '/api/admin/payments' })

  // Accounting & Finance
  await app.register(adminAccountingRoutes,  { prefix: '/api/admin/accounting' })
  await app.register(adminPartnerRoutes,     { prefix: '/api/admin/partners' })
  await app.register(adminServerRoutes,      { prefix: '/api/admin/servers' })
  await app.register(adminMarketingRoutes,   { prefix: '/api/admin/marketing' })

  // Communications
  await app.register(adminFunnelRoutes,      { prefix: '/api/admin/communications' })
  await app.register(adminBroadcastRoutes,   { prefix: '/api/admin/broadcast' })
  await app.register(adminBotBlockRoutes,    { prefix: '/api/admin/bot-blocks' })

  // Analytics & Reports
  await app.register(adminAnalyticsRoutes,   { prefix: '/api/admin/analytics' })
  await app.register(adminReportRoutes,      { prefix: '/api/admin/reports' })

  // Uploads
  app.register(import('@fastify/static'), { root: '/app/uploads', prefix: '/uploads/', decorateReply: false })
}
