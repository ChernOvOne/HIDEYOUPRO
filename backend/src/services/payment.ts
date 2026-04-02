import { prisma } from '../db'
import { config } from '../config'
import { logger } from '../utils/logger'
import { remnawave } from './remnawave'
import { balanceService } from './balance'
import { notifications } from './notifications'
import axios from 'axios'

class PaymentService {
  // Universal order creation (used by bot)
  async createOrder(params: { user: any; tariff: any; provider: string; currency?: string; purpose?: string }) {
    const { user, tariff, provider } = params
    const amount = provider === 'yukassa' ? Number(tariff.priceRub) : Number(tariff.priceUsdt || tariff.priceRub)
    const desc = `${tariff.name} — ${user.telegramName || user.email || user.id}`

    if (provider === 'yukassa' || provider === 'YUKASSA') {
      return this.createYukassaPayment({ userId: user.id, tariffId: tariff.id, amount, description: desc })
    } else {
      return this.createCryptoPayment({ userId: user.id, tariffId: tariff.id, amount, description: desc })
    }
  }

  // Create YuKassa payment
  async createYukassaPayment(params: { userId: string; tariffId: string; amount: number; description: string; returnUrl?: string }) {
    if (!config.yukassa.enabled) throw new Error('ЮKassa не настроена')

    const { data } = await axios.post(
      'https://api.yookassa.ru/v3/payments',
      {
        amount: { value: params.amount.toFixed(2), currency: 'RUB' },
        capture: true,
        description: params.description,
        confirmation: {
          type: 'redirect',
          return_url: params.returnUrl || config.yukassa.returnUrl || `${config.appUrl}/dashboard/payment-success`,
        },
        metadata: { userId: params.userId, tariffId: params.tariffId },
      },
      {
        auth: { username: config.yukassa.shopId!, password: config.yukassa.secretKey! },
        headers: { 'Idempotence-Key': `${params.userId}-${params.tariffId}-${Date.now()}` },
      },
    )

    // Create pending payment
    const payment = await prisma.payment.create({
      data: {
        userId:     params.userId,
        tariffId:   params.tariffId,
        amount:     params.amount,
        currency:   'RUB',
        status:     'PENDING',
        provider:   'YUKASSA',
        purpose:    'SUBSCRIPTION',
        externalId: data.id,
      },
    })

    return { paymentUrl: data.confirmation?.confirmation_url, paymentId: payment.id, externalId: data.id }
  }

  // Create CryptoPay invoice
  async createCryptoPayment(params: { userId: string; tariffId: string; amount: number; description: string }) {
    if (!config.cryptopay.enabled) throw new Error('CryptoPay не настроен')

    const baseUrl = config.cryptopay.network === 'testnet'
      ? 'https://testnet-pay.crypt.bot'
      : 'https://pay.crypt.bot'

    const { data } = await axios.post(
      `${baseUrl}/api/createInvoice`,
      {
        asset: 'USDT',
        amount: params.amount.toFixed(2),
        description: params.description,
        payload: JSON.stringify({ userId: params.userId, tariffId: params.tariffId }),
      },
      { headers: { 'Crypto-Pay-API-Token': config.cryptopay.apiToken } },
    )

    const invoice = data.result

    const payment = await prisma.payment.create({
      data: {
        userId:     params.userId,
        tariffId:   params.tariffId,
        amount:     params.amount,
        currency:   'USDT',
        status:     'PENDING',
        provider:   'CRYPTOPAY',
        purpose:    'SUBSCRIPTION',
        externalId: String(invoice.invoice_id),
      },
    })

    return { paymentUrl: invoice.pay_url, paymentId: payment.id, invoiceId: invoice.invoice_id }
  }

  // ── Get payment status from YuKassa ──────────────────────────
  async getYukassaPayment(yukassaId: string) {
    const { data } = await axios.get(
      `https://api.yookassa.ru/v3/payments/${yukassaId}`,
      { auth: { username: config.yukassa.shopId!, password: config.yukassa.secretKey! } },
    )
    return data as { id: string; status: string; paid: boolean }
  }

  // ── Get invoice status from CryptoPay ────────────────────────
  async getCryptoInvoice(invoiceId: string) {
    const baseUrl = config.cryptopay.network === 'testnet'
      ? 'https://testnet-pay.crypt.bot'
      : 'https://pay.crypt.bot'
    const { data } = await axios.get(`${baseUrl}/api/getInvoices`, {
      params:  { invoice_ids: invoiceId },
      headers: { 'Crypto-Pay-API-Token': config.cryptopay.apiToken },
    })
    return data.result?.items?.[0] as { status: string } | undefined
  }

  // ── Confirm payment & activate subscription ──────────────────
  async confirmPayment(orderId: string) {
    const payment = await prisma.payment.findUnique({
      where:   { id: orderId },
      include: { user: true, tariff: true },
    })

    if (!payment) throw new Error(`Payment not found: ${orderId}`)
    if (payment.status === 'PAID') {
      logger.info(`Payment ${orderId} already confirmed, skipping`)
      return
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: orderId },
      data:  { status: 'PAID', paidAt: new Date() },
    })

    const { user, tariff } = payment
    if (!tariff) {
      logger.warn(`Payment ${orderId} has no tariff, skipping activation`)
      return
    }

    // Override tariff values from payment metadata (variants/configurator)
    const meta = payment.metadata as Record<string, any> | null

    let effectiveDays = tariff.durationDays
    let effectiveTrafficGb = tariff.trafficGb
    let effectiveDeviceLimit = tariff.deviceLimit

    if (meta?._mode === 'variant') {
      effectiveDays = meta.days ?? effectiveDays
      if (meta.trafficGb != null) effectiveTrafficGb = meta.trafficGb
      if (meta.deviceLimit != null) effectiveDeviceLimit = meta.deviceLimit
    }
    if (meta?._mode === 'configurator') {
      effectiveDays = meta.days ?? effectiveDays
      effectiveTrafficGb = meta.trafficGb ?? effectiveTrafficGb
      effectiveDeviceLimit = meta.devices ?? effectiveDeviceLimit
    }

    // Handle balance top-up
    if (payment.purpose === 'TOPUP') {
      await balanceService.credit({
        userId:      user.id,
        amount:      Number(payment.amount),
        type:        'TOPUP',
        description: `Пополнение баланса (платёж ${payment.id})`,
      })
      logger.info(`Balance top-up confirmed: ${orderId}, +${payment.amount} ${payment.currency}`)
      return
    }

    // Handle gift payment
    if (payment.purpose === 'GIFT') {
      try {
        const { giftService } = await import('./gift')
        let recipientEmail: string | undefined
        let message: string | undefined
        if (meta?._giftMeta) {
          recipientEmail = meta.recipientEmail || undefined
          message = meta.message || undefined
        }
        await giftService.createGift({
          fromUserId:     user.id,
          tariffId:       payment.tariffId!,
          paymentId:      payment.id,
          recipientEmail,
          message,
        })
        logger.info(`Gift created from payment: ${orderId}`)
      } catch (err) {
        logger.error(`Failed to create gift from payment ${orderId}:`, err)
      }
      return
    }

    // Activate / extend REMNAWAVE subscription
    if (!remnawave.configured) {
      logger.warn('REMNAWAVE not configured, skipping subscription activation')
      await prisma.user.update({
        where: { id: user.id },
        data:  { subStatus: 'ACTIVE', subExpireAt: new Date(Date.now() + effectiveDays * 86400_000) },
      })
      return
    }

    const trafficLimitBytes = effectiveTrafficGb ? effectiveTrafficGb * 1024 * 1024 * 1024 : 0

    if (!user.remnawaveUuid) {
      // Create user in REMNAWAVE on first purchase
      const newExpireDate = new Date(Date.now() + effectiveDays * 86400_000)
      const rmUser = await remnawave.createUser({
        username:             user.email ? user.email.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '_') : user.telegramId ? `tg_${user.telegramId}` : `user_${user.id.slice(0, 8)}`,
        email:                user.email ?? undefined,
        telegramId:           user.telegramId ? parseInt(user.telegramId, 10) : null,
        expireAt:             newExpireDate.toISOString(),
        trafficLimitBytes,
        trafficLimitStrategy: tariff.trafficStrategy || 'MONTH',
        hwidDeviceLimit:      effectiveDeviceLimit ?? 3,
        tag:                  tariff.remnawaveTag ?? undefined,
        activeInternalSquads: tariff.remnawaveSquads.length > 0 ? tariff.remnawaveSquads : undefined,
      })

      await prisma.user.update({
        where: { id: user.id },
        data:  {
          remnawaveUuid: rmUser.uuid,
          subLink:       remnawave.getSubscriptionUrl(rmUser.uuid),
          subStatus:     'ACTIVE',
          subExpireAt:   newExpireDate,
        },
      })
    } else {
      // Extend existing subscription
      const rmUser = await remnawave.getUserByUuid(user.remnawaveUuid)
      const currentExpire = rmUser.expireAt ? new Date(rmUser.expireAt) : new Date()
      const base = currentExpire > new Date() ? currentExpire : new Date()
      base.setDate(base.getDate() + effectiveDays)

      await remnawave.updateUser({
        uuid:                 user.remnawaveUuid,
        status:               'ACTIVE',
        expireAt:             base.toISOString(),
        trafficLimitBytes,
        trafficLimitStrategy: tariff.trafficStrategy || 'MONTH',
        hwidDeviceLimit:      effectiveDeviceLimit ?? 3,
        tag:                  tariff.remnawaveTag ?? undefined,
        activeInternalSquads: tariff.remnawaveSquads.length > 0 ? tariff.remnawaveSquads : undefined,
      })

      await remnawave.resetTrafficAction(user.remnawaveUuid).catch(err =>
        logger.warn(`Failed to reset traffic for ${user.remnawaveUuid}:`, err)
      )

      const newExpireAt = new Date()
      if (user.subExpireAt && user.subExpireAt > newExpireAt) {
        newExpireAt.setTime(user.subExpireAt.getTime())
      }
      newExpireAt.setDate(newExpireAt.getDate() + effectiveDays)

      await prisma.user.update({
        where: { id: user.id },
        data:  { subStatus: 'ACTIVE', subExpireAt: newExpireAt },
      })
    }

    // Handle referral bonus
    if (user.referredById) {
      await this.applyReferralBonus(user.referredById, payment.id).catch(err =>
        logger.warn('Referral bonus failed:', err)
      )
    }

    // Calculate new expire date for notification
    const newExpireAt = new Date(Date.now() + effectiveDays * 86400_000)

    logger.info(`Payment confirmed: ${orderId}, user: ${user.id}, +${effectiveDays} days`)

    // Send notification (TG + Email)
    await notifications.paymentConfirmed(user.id, tariff.name, newExpireAt).catch(err =>
      logger.warn('Payment notification failed:', err)
    )

    // Trigger payment funnel
    import('./funnel-engine').then(({ triggerEvent }) =>
      triggerEvent('payment_success', user.id, { tariffName: tariff.name, amount: String(payment.amount) }).catch(() => {})
    )
  }

  // ── Referral bonus ────────────────────────────────────────────
  private async applyReferralBonus(referrerId: string, paymentId: string) {
    const referrer = await prisma.user.findUnique({ where: { id: referrerId } })
    if (!referrer) return

    // Check if bonus already applied for this payment
    const existing = await prisma.referralBonus.findUnique({
      where: { triggeredByPaymentId: paymentId },
    })
    if (existing) return

    const rewardType = config.referral.rewardType // 'days' | 'balance' | 'both'
    const bonusDays = config.referral.bonusDays

    // Days bonus
    const applyDays = rewardType === 'days' || rewardType === 'both'
    if (applyDays) {
      await prisma.referralBonus.create({
        data: {
          referrerId,
          triggeredByPaymentId: paymentId,
          bonusType:  'DAYS',
          bonusDays,
        },
      })
      await notifications.referralBonus(referrerId, bonusDays).catch(() => {})
      logger.info(`Referral days accumulated: +${bonusDays} days for ${referrerId}`)
    }

    // Money bonus
    const applyMoney = rewardType === 'balance' || rewardType === 'both'
    if (applyMoney) {
      const amount = config.referral.rewardAmount
      if (!applyDays) {
        await prisma.referralBonus.create({
          data: {
            referrerId,
            triggeredByPaymentId: paymentId,
            bonusType:    'MONEY',
            bonusAmount:  amount,
          },
        })
      }
      await balanceService.credit({
        userId:      referrerId,
        amount,
        type:        'REFERRAL',
        description: `Реферальный бонус`,
      })
      await notifications.referralBonusMoney(referrerId, amount).catch(() => {})
      logger.info(`Referral money bonus: +${amount} RUB for ${referrerId}`)
    }

    // Trigger referral funnel
    import('./funnel-engine').then(({ triggerEvent }) =>
      triggerEvent('referral_paid', referrerId, { refBonusDays: String(bonusDays) }).catch(() => {})
    )
  }
}

export const paymentService = new PaymentService()
