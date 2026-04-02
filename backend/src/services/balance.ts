import { prisma } from '../db'
import { logger } from '../utils/logger'

class BalanceService {
  async credit(params: { userId: string; amount: number; type: string; description?: string }) {
    const { userId, amount, type, description } = params
    const [, transaction] = await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { balance: { increment: amount } } }),
      prisma.balanceTransaction.create({
        data: { userId, amount, type: type as any, description },
      }),
    ])
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } })
    logger.info(`Balance credit: +${amount} RUB to user ${userId} (${type})`)
    return { transaction, balance: Number(user?.balance ?? 0) }
  }

  async debit(params: { userId: string; amount: number; type: string; description?: string }) {
    const { userId, amount, type, description } = params
    // Check sufficient balance
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } })
    if (!user || Number(user.balance) < amount) {
      throw new Error('Недостаточно средств на балансе')
    }
    const [, transaction] = await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { balance: { decrement: amount } } }),
      prisma.balanceTransaction.create({
        data: { userId, amount: -amount, type: type as any, description },
      }),
    ])
    const updated = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } })
    return { transaction, balance: Number(updated?.balance ?? 0) }
  }

  async getBalance(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } })
    const history = await prisma.balanceTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return { balance: Number(user?.balance ?? 0), history }
  }

  /** Admin manual balance adjustment (positive or negative) */
  async adminAdjust(params: { userId: string; amount: number; description: string; adminId?: string }) {
    const { userId, amount, description } = params
    const type = amount >= 0 ? 'TOPUP' : 'DEBIT'
    const absAmount = Math.abs(amount)

    const [, transaction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data:  { balance: amount >= 0 ? { increment: absAmount } : { decrement: absAmount } },
      }),
      prisma.balanceTransaction.create({
        data: { userId, amount, type: type as any, description },
      }),
    ])

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } })
    logger.info(`Admin balance adjust: ${amount > 0 ? '+' : ''}${amount} RUB for ${userId}: ${description}`)
    return { transaction, balance: Number(user?.balance ?? 0) }
  }
}

export const balanceService = new BalanceService()
