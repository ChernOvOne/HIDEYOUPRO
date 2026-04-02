import type { FastifyInstance } from 'fastify'
import { createHash, createHmac } from 'crypto'
import { paymentService } from '../services/payment'
import { logger }         from '../utils/logger'
import { prisma }         from '../db'
import { config }         from '../config'

export async function webhookRoutes(app: FastifyInstance) {
  // ── ЮKassa webhook ─────────────────────────────────────────
  app.post('/yukassa', {
    config: { rawBody: true }, // needed for signature check
  }, async (req, reply) => {
    try {
      const body = req.body as any

      // ЮKassa sends event type in top-level field
      if (body.event !== 'payment.succeeded') {
        return reply.status(200).send({ ok: true })
      }

      const externalId = body.object?.id
      const metadata = body.object?.metadata || {}
      const orderId  = metadata.orderId

      // Find payment by our orderId or by external yukassa id
      const payment = await prisma.payment.findFirst({
        where: {
          OR: [
            ...(orderId ? [{ id: orderId }] : []),
            ...(externalId ? [{ externalId }] : []),
          ],
          provider: 'YUKASSA',
        },
      })

      if (!payment) {
        logger.warn(`ЮKassa webhook: payment not found orderId=${orderId} externalId=${externalId}`)
        return reply.status(200).send({ ok: true })
      }

      if (payment.status !== 'PAID') {
        await paymentService.confirmPayment(payment.id)
        logger.info(`ЮKassa payment confirmed: ${payment.id}`)
      }

      return reply.status(200).send({ ok: true })
    } catch (err) {
      logger.error('ЮKassa webhook error:', err)
      return reply.status(200).send({ ok: true })
    }
  })

  // ── CryptoPay webhook ──────────────────────────────────────
  app.post('/cryptopay', async (req, reply) => {
    try {
      // Verify signature
      const signature = req.headers['crypto-pay-api-signature'] as string
      const body      = req.body as any

      if (signature && config.cryptopay.apiToken) {
        const secretKey = createHash('sha256').update(config.cryptopay.apiToken).digest()
        const checkHash = createHmac('sha256', secretKey).update(JSON.stringify(body)).digest('hex')
        if (checkHash !== signature) {
          logger.warn('CryptoPay webhook: invalid signature')
          return reply.status(401).send({ error: 'Invalid signature' })
        }
      }

      if (body.update_type !== 'invoice_paid') {
        return reply.status(200).send({ ok: true })
      }

      const invoiceId = String(body.payload?.invoice_id || '')
      const orderId   = body.payload?.payload // our orderId stored as payload

      // Find payment by our orderId or by external invoice id
      const payment = await prisma.payment.findFirst({
        where: {
          OR: [
            ...(orderId ? [{ id: orderId }] : []),
            ...(invoiceId ? [{ externalId: invoiceId }] : []),
          ],
          provider: 'CRYPTOPAY',
        },
      })

      if (!payment) {
        logger.warn(`CryptoPay webhook: payment not found orderId=${orderId}`)
        return reply.status(200).send({ ok: true })
      }

      if (payment.status !== 'PAID') {
        await paymentService.confirmPayment(payment.id)
        logger.info(`CryptoPay payment confirmed: ${payment.id}`)
      }

      return reply.status(200).send({ ok: true })
    } catch (err) {
      logger.error('CryptoPay webhook error:', err)
      return reply.status(200).send({ ok: true })
    }
  })
}
