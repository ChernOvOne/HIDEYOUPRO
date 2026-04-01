/**
 * HIDEYOU PRO — Legacy Data Migration
 * Imports users from contacts.xlsx and payments from all-payments.csv
 * Links referral chains, matches payments to users by legacy ID.
 */

import { prisma } from '../db'
import ExcelJS from 'exceljs'
import * as fs from 'fs'
import * as path from 'path'

const CONTACTS_PATH = path.resolve(__dirname, '../../EXCEL/contacts.xlsx')
const PAYMENTS_PATH = path.resolve(__dirname, '../../EXCEL/all-payments.csv')

function cellStr(row: ExcelJS.Row, col: number): string {
  const raw = row.getCell(col).value
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'object' && raw !== null) {
    if ('hyperlink' in raw && typeof (raw as any).hyperlink === 'string') {
      const hl = (raw as any).hyperlink as string
      return hl.startsWith('mailto:') ? hl.replace('mailto:', '').trim() : hl.trim()
    }
    if ('text' in raw) return String((raw as any).text).trim()
    if ('result' in raw) return String((raw as any).result).trim()
  }
  return String(raw).trim()
}

async function run() {
  console.log('=== HIDEYOU PRO — Legacy Migration ===\n')

  // ── Step 1: Parse contacts.xlsx ──
  console.log('1. Parsing contacts.xlsx...')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(CONTACTS_PATH)
  const ws = wb.worksheets[0]
  console.log(`   ${ws.rowCount - 1} rows found\n`)

  // Map legacy ID → user data
  type LegacyUser = {
    legacyId: string
    name: string
    username: string
    email: string
    telegramId: string
    referrerId: string
    balance: number
    uuid: string
    subUrl: string
  }

  const legacyUsers: LegacyUser[] = []

  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i)
    const legacyId = cellStr(row, 1)  // col 1: ID
    if (!legacyId) continue

    const telegramId = cellStr(row, 10) // col 10: Telegram ID
    if (!telegramId) continue // must have TG ID

    legacyUsers.push({
      legacyId,
      name: cellStr(row, 2),        // col 2: Имя
      username: cellStr(row, 4).replace('@', ''),  // col 4: Username
      email: cellStr(row, 6),        // col 6: Email
      telegramId,
      referrerId: cellStr(row, 11),  // col 11: Referrer ID
      balance: parseFloat(cellStr(row, 33)) || 0,  // col 33: баланс юзера
      uuid: cellStr(row, 144),       // col 144: uuid (REMNAWAVE)
      subUrl: cellStr(row, 15),      // col 15: url_sub1
    })
  }

  console.log(`   Parsed ${legacyUsers.length} users with TG ID\n`)

  // ── Step 2: Import users ──
  console.log('2. Importing users...')
  const legacyIdToDbId = new Map<string, string>() // legacy ID → DB user ID
  let created = 0, updated = 0, skipped = 0

  for (const lu of legacyUsers) {
    try {
      // Find by telegramId
      let user = await prisma.user.findUnique({ where: { telegramId: lu.telegramId } })

      const data: any = {
        telegramName: lu.username || lu.name || undefined,
        remnawaveUuid: lu.uuid || undefined,
        balance: lu.balance || undefined,
        subLink: lu.subUrl || undefined,
      }
      if (lu.email && lu.email.includes('@')) data.email = lu.email

      if (user) {
        await prisma.user.update({ where: { id: user.id }, data })
        legacyIdToDbId.set(lu.legacyId, user.id)
        updated++
      } else {
        user = await prisma.user.create({
          data: {
            telegramId: lu.telegramId,
            ...data,
          },
        })
        legacyIdToDbId.set(lu.legacyId, user.id)
        created++
      }
    } catch (e: any) {
      skipped++
      if (skipped <= 5) console.log(`   Skip: ${lu.legacyId} — ${e.message}`)
    }
  }

  console.log(`   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}\n`)

  // ── Step 3: Link referral chains ──
  console.log('3. Linking referrals...')
  let refLinked = 0

  for (const lu of legacyUsers) {
    if (!lu.referrerId) continue
    const userId = legacyIdToDbId.get(lu.legacyId)
    const referrerId = legacyIdToDbId.get(lu.referrerId)
    if (!userId || !referrerId || userId === referrerId) continue

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { referrerId },
      })
      refLinked++
    } catch {}
  }

  console.log(`   Linked ${refLinked} referrals\n`)

  // ── Step 4: Parse and import payments ──
  console.log('4. Parsing all-payments.csv...')
  const csvContent = fs.readFileSync(PAYMENTS_PATH, 'utf-8')
  const csvLines = csvContent.split('\n').filter(l => l.trim())
  console.log(`   ${csvLines.length - 1} payment rows\n`)

  console.log('5. Importing payments...')
  let paymentsImported = 0, paymentsSkipped = 0

  // CSV header: Дата создания;Дата платежа;ID платежа;Статус;Сумма;К зачислению;Валюта;Описание;Метод;...
  for (let i = 1; i < csvLines.length; i++) {
    const cols = csvLines[i].split(';').map(c => c.replace(/^"|"$/g, '').trim())
    const dateStr = cols[1]  // Дата платежа
    const paymentId = cols[2] // ID платежа
    const status = cols[3]    // Статус
    const amount = parseFloat(cols[4]?.replace(',', '.') || '0')
    const amountNet = parseFloat(cols[5]?.replace(',', '.') || '0')
    const currency = cols[6] || 'RUB'
    const description = cols[7]?.replace(/^"|"$/g, '') || ''

    // Extract legacy ID from description: [ID55389066]
    const idMatch = description.match(/\[ID(\d+)\]/)
    if (!idMatch) { paymentsSkipped++; continue }

    const legacyId = idMatch[1]
    const userId = legacyIdToDbId.get(legacyId)
    if (!userId) { paymentsSkipped++; continue }

    // Parse date: DD.MM.YYYY HH:MM:SS
    let paidAt: Date | null = null
    if (dateStr) {
      const m = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}:\d{2}:\d{2})/)
      if (m) paidAt = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}`)
    }

    const isPaid = status === 'Оплачен'

    try {
      // Check if payment already exists (by externalId)
      const existing = await prisma.payment.findFirst({ where: { externalId: paymentId } })
      if (existing) continue

      await prisma.payment.create({
        data: {
          userId,
          amount,
          currency,
          status: isPaid ? 'PAID' : status === 'Отменен' ? 'FAILED' : 'PENDING',
          provider: 'YUKASSA',
          purpose: 'SUBSCRIPTION',
          externalId: paymentId,
          description: description.substring(0, 200),
          paidAt: isPaid && paidAt ? paidAt : undefined,
          createdAt: paidAt || undefined,
        },
      })
      paymentsImported++
    } catch (e: any) {
      paymentsSkipped++
      if (paymentsSkipped <= 5) console.log(`   Payment skip: ${paymentId} — ${e.message}`)
    }
  }

  console.log(`   Imported: ${paymentsImported}, Skipped: ${paymentsSkipped}\n`)

  // ── Step 6: Update payment stats ──
  console.log('6. Updating user payment stats...')
  const userStats = await prisma.payment.groupBy({
    by: ['userId'],
    where: { status: 'PAID' },
    _sum: { amount: true },
    _count: true,
  })

  for (const s of userStats) {
    await prisma.user.update({
      where: { id: s.userId },
      data: {
        totalPaid: Number(s._sum.amount || 0),
        paymentsCount: s._count,
      },
    })
  }

  console.log(`   Updated ${userStats.length} users\n`)

  // ── Summary ──
  console.log('=== MIGRATION COMPLETE ===')
  console.log(`Users:     ${created} created, ${updated} updated`)
  console.log(`Referrals: ${refLinked} linked`)
  console.log(`Payments:  ${paymentsImported} imported`)
  console.log('')
}

run()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error('FATAL:', e); prisma.$disconnect(); process.exit(1) })
