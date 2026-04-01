import { prisma } from '../db'
import { logger } from '../utils/logger'

class BalanceService {
  async credit(params: { userId: string; amount: number; type: string; description?: string }) {
    const { userId, amount, type, description } = params
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { balance: { increment: amount } } }),
      prisma.balanceTransaction.create({
        data: { userId, amount, type: type as any, description },
      }),
    ])
    logger.info(`Balance credit: +${amount} RUB to user ${userId} (${type})`)
  }

  async debit(params: { userId: string; amount: number; type: string; description?: string }) {
    const { userId, amount, type, description } = params
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { balance: { decrement: amount } } }),
      prisma.balanceTransaction.create({
        data: { userId, amount: -amount, type: type as any, description },
      }),
    ])
  }

  async getBalance(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { balance: true } })
    return Number(user?.balance ?? 0)
  }
}

export const balanceService = new BalanceService()
