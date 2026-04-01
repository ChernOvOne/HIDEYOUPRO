import { prisma } from '../db'
import { config } from '../config'
import { logger } from '../utils/logger'
import axios from 'axios'

class PaymentService {
  // Universal order creation (used by bot)
  async createOrder(params: { user: any; tariff: any; provider: string }) {
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
    await prisma.payment.create({
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

    return { paymentUrl: data.confirmation?.confirmation_url, paymentId: data.id }
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

    await prisma.payment.create({
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

    return { paymentUrl: invoice.pay_url, invoiceId: invoice.invoice_id }
  }
}

export const paymentService = new PaymentService()
