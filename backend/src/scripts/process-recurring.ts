import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Run daily — auto-create expense transactions for recurring payments due today
 */
async function processRecurringPayments() {
  console.log('Processing recurring payments...')

  const today = new Date()
  const dayOfMonth = today.getDate()

  const duePayments = await prisma.recurringPayment.findMany({
    where: { isActive: true, paymentDay: dayOfMonth },
    include: { category: true, server: true },
  })

  if (duePayments.length === 0) {
    console.log('No recurring payments due today')
    await prisma.$disconnect()
    return
  }

  let created = 0
  for (const rp of duePayments) {
    // Check if transaction already exists for this month
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)

    const existing = await prisma.transaction.findFirst({
      where: {
        description: { contains: `[auto:${rp.id}]` },
        date: { gte: startOfMonth, lt: endOfMonth },
      },
    })

    if (existing) {
      console.log(`  Skip: ${rp.name} — already processed this month`)
      continue
    }

    // Create expense transaction
    await prisma.transaction.create({
      data: {
        type:        'EXPENSE',
        amount:      rp.amount,
        description: `${rp.name} (${rp.currency}) [auto:${rp.id}]`,
        categoryId:  rp.categoryId,
        date:        today,
      },
    })

    created++
    console.log(`  Created: ${rp.name} — ${rp.amount} ${rp.currency}`)
  }

  console.log(`Recurring payments done: ${created} transactions created`)
  await prisma.$disconnect()
}

if (require.main === module) {
  processRecurringPayments().catch(err => {
    console.error('Recurring payment cron failed:', err)
    process.exit(1)
  })
}

export { processRecurringPayments }
