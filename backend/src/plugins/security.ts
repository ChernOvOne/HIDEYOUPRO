import type { FastifyInstance } from 'fastify'
import { config } from '../config'

export async function securityPlugin(app: FastifyInstance) {
  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Frame-Options', 'SAMEORIGIN')
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-XSS-Protection', '1; mode=block')
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
    if (config.isProd) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
    }
    reply.removeHeader('server')
    reply.removeHeader('x-powered-by')
  })
}
