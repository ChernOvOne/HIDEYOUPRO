import type { FastifyInstance } from 'fastify'
import fastifyCookie    from '@fastify/cookie'
import fastifyJwt       from '@fastify/jwt'
import fastifyCors      from '@fastify/cors'
import fastifyRateLimit from '@fastify/rate-limit'
import { securityPlugin } from './security'
import { config }         from '../config'

export async function registerPlugins(app: FastifyInstance) {
  await app.register(securityPlugin)

  const corsOrigins: (string | RegExp)[] = [
    config.appUrl,
    `https://${config.domain}`,
  ]
  if (config.isDev) corsOrigins.push('http://localhost:3000', 'http://localhost:4000')

  await app.register(fastifyCors, { origin: corsOrigins, credentials: true })
  await app.register(fastifyCookie, { secret: config.cookieSecret, hook: 'onRequest' })
  await app.register(fastifyJwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: 'token', signed: true },
    sign:   { expiresIn: config.jwtExpires },
  })

  // Auth decorators
  app.decorate('authenticate', async function (req: any, reply: any) {
    try { await req.jwtVerify() }
    catch { reply.status(401).send({ error: 'Unauthorized' }) }
  })

  app.decorate('adminOnly', async function (req: any, reply: any) {
    try {
      await req.jwtVerify()
      const role = (req.user as any).role
      if (role !== 'ADMIN' && role !== 'EDITOR') {
        reply.status(403).send({ error: 'Forbidden' })
      }
    } catch { reply.status(401).send({ error: 'Unauthorized' }) }
  })

  app.decorate('adminStrict', async function (req: any, reply: any) {
    try {
      await req.jwtVerify()
      if ((req.user as any).role !== 'ADMIN') {
        reply.status(403).send({ error: 'Forbidden' })
      }
    } catch { reply.status(401).send({ error: 'Unauthorized' }) }
  })

  await app.register(fastifyRateLimit, {
    max: 300, timeWindow: '1 minute',
    allowList: (req: any) => {
      const url = req.url || ''
      return url.startsWith('/api/setup') || url.startsWith('/api/auth') || url.startsWith('/health')
    },
    errorResponseBuilder: () => ({ error: 'Too many requests' }),
  })
}
