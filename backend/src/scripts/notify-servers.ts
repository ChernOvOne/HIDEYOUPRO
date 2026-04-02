import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Run daily — notify about servers with upcoming payments
 * Sends to NotificationChannel with notifyServer=true
 */
async function runServerAlerts() {
  console.log('Running server payment alerts...')

  const servers = await prisma.server.findMany({
    where: { isActive: true, paymentDay: { not: null } },
  })

  const channels = await prisma.notificationChannel.findMany({
    where: { isActive: true, notifyServer: true },
  })

  if (channels.length === 0) {
    console.log('No notification channels configured for server alerts')
    await prisma.$disconnect()
    return
  }

  const now = new Date()
  let alertCount = 0

  for (const server of servers) {
    if (!server.paymentDay) continue

    // Calculate next payment date
    const nextPayment = new Date(now.getFullYear(), now.getMonth(), server.paymentDay)
    if (nextPayment <= now) nextPayment.setMonth(nextPayment.getMonth() + 1)

    const daysUntil = Math.ceil((nextPayment.getTime() - now.getTime()) / 86400_000)
    const threshold = server.notifyDaysBefore ?? 3

    if (daysUntil <= threshold && daysUntil >= 0) {
      const text = [
        `Server: ${server.name}`,
        `Payment in ${daysUntil} day(s)`,
        `Amount: ${server.monthlyCost} ${server.currency}`,
        server.provider ? `Provider: ${server.provider}` : '',
        server.ipAddress ? `IP: ${server.ipAddress}` : '',
      ].filter(Boolean).join('\n')

      // Send to all configured channels
      for (const ch of channels) {
        try {
          // Dynamic import to avoid loading bot at script level
          const { default: axios } = await import('axios')
          const botToken = process.env.TELEGRAM_BOT_TOKEN
          if (botToken) {
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              chat_id: ch.chatId,
              text: `🖥 ${text}`,
            })
          }
          alertCount++
        } catch (err: any) {
          console.error(`Failed to send alert for ${server.name} to ${ch.name}:`, err.message)
        }
      }
    }
  }

  console.log(`Server alerts done: ${alertCount} sent`)
  await prisma.$disconnect()
}

if (require.main === module) {
  runServerAlerts().catch(err => {
    console.error('Server alert cron failed:', err)
    process.exit(1)
  })
}

export { runServerAlerts }
