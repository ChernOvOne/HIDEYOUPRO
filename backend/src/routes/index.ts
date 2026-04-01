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
import { adminImportRoutes }      from './admin-import'
import { adminImportExcelRoutes } from './admin-import-excel'
import { adminDataImportRoutes }  from './admin-data-import'
import { adminLandingRoutes }     from './admin-landing'
import { userRoutes }             from './users'
import { tariffRoutes }           from './tariffs'
import { paymentRoutes }          from './payments'
import { webhookRoutes }          from './webhooks'
import { publicRoutes }           from './public'
import { giftRoutes }             from './gifts'
import { verificationRoutes }     from './verification'
import { userPromoRoutes }        from './promo'
import { newsRoutes, adminNewsRoutes }               from './news'
import { notificationRoutes, adminNotificationRoutes } from './notifications'
import { proxyRoutes, adminProxyRoutes }             from './proxies'
import { instructionRoutes, adminInstructionRoutes } from './instructions'
import { uploadRoutes }           from './upload'
import { adminExtrasRoutes }     from './admin-extras'
import { tmaAuthRoute }         from './tma-auth'

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    status:    'ok',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()),
  }))

  // Auth
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(tmaAuthRoute, { prefix: '/api/auth' })
  await app.register(setupRoutes, { prefix: '/api/setup' })

  // Public
  await app.register(publicRoutes, { prefix: '/api/public' })
  await app.register(newsRoutes,   { prefix: '/api/news' })

  // User-facing
  await app.register(userRoutes,         { prefix: '/api/user' })
  await app.register(tariffRoutes,       { prefix: '/api/tariffs' })
  await app.register(paymentRoutes,      { prefix: '/api/payments/user' })
  await app.register(giftRoutes,         { prefix: '/api/gifts' })
  await app.register(verificationRoutes, { prefix: '/api/verification' })
  await app.register(userPromoRoutes,    { prefix: '/api/user/promo' })
  await app.register(notificationRoutes, { prefix: '/api/notifications' })
  await app.register(proxyRoutes,        { prefix: '/api/proxies' })
  await app.register(instructionRoutes,  { prefix: '/api/instructions' })

  // Webhooks
  await app.register(webhookRoutes,        { prefix: '/api/webhooks' })
  await app.register(paymentWebhookRoutes, { prefix: '/api/payments' })

  // Admin core
  await app.register(adminRoutes,              { prefix: '/api/admin' })
  await app.register(adminUserRoutes,          { prefix: '/api/admin/users' })
  await app.register(adminTariffRoutes,        { prefix: '/api/admin/tariffs' })
  await app.register(adminPaymentRoutes,       { prefix: '/api/admin/payments' })
  await app.register(adminNewsRoutes,          { prefix: '/api/admin/news' })
  await app.register(adminNotificationRoutes,  { prefix: '/api/admin/notifications' })
  await app.register(adminProxyRoutes,         { prefix: '/api/admin/proxies' })
  await app.register(adminInstructionRoutes,   { prefix: '/api/admin/instructions' })
  await app.register(adminImportRoutes,        { prefix: '/api/admin/import' })
  await app.register(adminImportExcelRoutes,   { prefix: '/api/admin/import-excel' })
  await app.register(adminDataImportRoutes,    { prefix: '/api/admin/data-import' })
  await app.register(adminLandingRoutes,       { prefix: '/api/admin/landing' })
  await app.register(uploadRoutes,             { prefix: '/api/admin' })

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
  await app.register(adminExtrasRoutes,     { prefix: '/api/admin/extras' })

  // Uploads
  app.register(import('@fastify/static'), { root: '/app/uploads', prefix: '/uploads/', decorateReply: false })
}
