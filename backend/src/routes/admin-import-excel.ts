import type { FastifyInstance } from 'fastify'
import ExcelJS from 'exceljs'
import { prisma } from '../db'

/* ───────────────────────────────────────────────────────────
   Excel Import / Export  —  templates & bulk upload
   ─────────────────────────────────────────────────────────── */

export async function adminImportExcelRoutes(app: FastifyInstance) {

  /* ════════════════════════════════════════════════════════════
     TEMPLATE DOWNLOADS
     ════════════════════════════════════════════════════════════ */

  // GET /templates/transactions
  app.get('/templates/transactions', async (_req, reply) => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Транзакции')

    ws.columns = [
      { header: 'date',        key: 'date',        width: 14 },
      { header: 'type',        key: 'type',        width: 12 },
      { header: 'amount',      key: 'amount',      width: 14 },
      { header: 'category',    key: 'category',    width: 20 },
      { header: 'description', key: 'description', width: 30 },
    ]

    // Style header row
    ws.getRow(1).font = { bold: true }

    // Example rows
    ws.addRow({ date: '01.01.2026', type: 'INCOME',  amount: 15000,  category: 'Подписки',  description: 'Оплата подписки — январь' })
    ws.addRow({ date: '05.01.2026', type: 'EXPENSE', amount: 3200,   category: 'Серверы',   description: 'Аренда VPS DE-1' })
    ws.addRow({ date: '10.01.2026', type: 'INCOME',  amount: 500,    category: 'Рефералы',  description: 'Реферальный бонус' })

    const buffer = await wb.xlsx.writeBuffer()
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    reply.header('Content-Disposition', 'attachment; filename="template-transactions.xlsx"')
    return reply.send(Buffer.from(buffer as ArrayBuffer))
  })

  // GET /templates/users
  app.get('/templates/users', async (_req, reply) => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Пользователи')

    ws.columns = [
      { header: 'telegram_id',          key: 'telegram_id',          width: 16 },
      { header: 'remnawave_uuid',       key: 'remnawave_uuid',       width: 38 },
      { header: 'email',                key: 'email',                width: 28 },
      { header: 'balance',              key: 'balance',              width: 12 },
      { header: 'username_tg',          key: 'username_tg',          width: 20 },
      { header: 'subscription_status',  key: 'subscription_status',  width: 20 },
      { header: 'sub_expire_date',      key: 'sub_expire_date',      width: 14 },
      { header: 'referral_code',        key: 'referral_code',        width: 18 },
    ]

    ws.getRow(1).font = { bold: true }

    ws.addRow({
      telegram_id:         '123456789',
      remnawave_uuid:      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      email:               'user@example.com',
      balance:             100,
      username_tg:         'ivan_vpn',
      subscription_status: 'ACTIVE',
      sub_expire_date:     '31.12.2026',
      referral_code:       'REF-IVAN',
    })
    ws.addRow({
      telegram_id:         '987654321',
      remnawave_uuid:      '',
      email:               'test@example.com',
      balance:             0,
      username_tg:         'test_user',
      subscription_status: 'INACTIVE',
      sub_expire_date:     '',
      referral_code:       '',
    })

    const buffer = await wb.xlsx.writeBuffer()
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    reply.header('Content-Disposition', 'attachment; filename="template-users.xlsx"')
    return reply.send(Buffer.from(buffer as ArrayBuffer))
  })

  /* ════════════════════════════════════════════════════════════
     IMPORT ENDPOINTS
     ════════════════════════════════════════════════════════════ */

  // POST /import/transactions
  app.post('/import/transactions', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'No file uploaded' })

    const buffer = await data.toBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as any)

    const ws = wb.worksheets[0]
    if (!ws) return reply.code(400).send({ error: 'Empty workbook' })

    // Build header map from first row
    const headerRow = ws.getRow(1)
    const headers: Record<string, number> = {}
    headerRow.eachCell((cell, colNumber) => {
      const val = String(cell.value ?? '').trim().toLowerCase()
      headers[val] = colNumber
    })

    const required = ['date', 'type', 'amount']
    for (const h of required) {
      if (!(h in headers)) {
        return reply.code(400).send({ error: `Missing required column: ${h}` })
      }
    }

    // Cache categories by name (lowercase)
    const existingCategories = await prisma.category.findMany()
    const categoryMap = new Map<string, string>()
    for (const c of existingCategories) {
      categoryMap.set(c.name.toLowerCase(), c.id)
    }

    let imported = 0
    const errors: string[] = []

    for (let rowIdx = 2; rowIdx <= ws.rowCount; rowIdx++) {
      const row = ws.getRow(rowIdx)
      // Skip completely empty rows
      if (!row.getCell(headers['date']).value && !row.getCell(headers['amount']).value) continue

      try {
        // Parse date (DD.MM.YYYY)
        const rawDate = String(row.getCell(headers['date']).value ?? '').trim()
        let parsedDate: Date
        const ddmmyyyy = rawDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
        if (ddmmyyyy) {
          parsedDate = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`)
        } else {
          // Fallback: try native parsing
          parsedDate = new Date(rawDate)
        }
        if (isNaN(parsedDate.getTime())) {
          errors.push(`Row ${rowIdx}: invalid date "${rawDate}"`)
          continue
        }

        // Type
        const rawType = String(row.getCell(headers['type']).value ?? '').trim().toUpperCase()
        if (rawType !== 'INCOME' && rawType !== 'EXPENSE') {
          errors.push(`Row ${rowIdx}: type must be INCOME or EXPENSE, got "${rawType}"`)
          continue
        }

        // Amount
        const amount = parseFloat(String(row.getCell(headers['amount']).value ?? '0'))
        if (isNaN(amount) || amount <= 0) {
          errors.push(`Row ${rowIdx}: invalid amount`)
          continue
        }

        // Category — resolve or create
        let categoryId: string | null = null
        if (headers['category']) {
          const catName = String(row.getCell(headers['category']).value ?? '').trim()
          if (catName) {
            const key = catName.toLowerCase()
            if (categoryMap.has(key)) {
              categoryId = categoryMap.get(key)!
            } else {
              const created = await prisma.category.create({ data: { name: catName } })
              categoryMap.set(key, created.id)
              categoryId = created.id
            }
          }
        }

        // Description
        const description = headers['description']
          ? String(row.getCell(headers['description']).value ?? '').trim() || null
          : null

        await prisma.transaction.create({
          data: {
            date:        parsedDate,
            type:        rawType as 'INCOME' | 'EXPENSE',
            amount,
            categoryId,
            description,
          },
        })
        imported++
      } catch (err: any) {
        errors.push(`Row ${rowIdx}: ${err.message ?? err}`)
      }
    }

    return { imported, errors }
  })

  // POST /import/users
  app.post('/import/users', async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: 'No file uploaded' })

    const buffer = await data.toBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as any)

    const ws = wb.worksheets[0]
    if (!ws) return reply.code(400).send({ error: 'Empty workbook' })

    const headerRow = ws.getRow(1)
    const headers: Record<string, number> = {}
    headerRow.eachCell((cell, colNumber) => {
      const val = String(cell.value ?? '').trim().toLowerCase()
      headers[val] = colNumber
    })

    // At least telegram_id or email required to identify user
    if (!headers['telegram_id'] && !headers['email']) {
      return reply.code(400).send({ error: 'File must have at least telegram_id or email column' })
    }

    let imported = 0
    let updated = 0
    const errors: string[] = []

    for (let rowIdx = 2; rowIdx <= ws.rowCount; rowIdx++) {
      const row = ws.getRow(rowIdx)

      const cell = (key: string): string => {
        if (!headers[key]) return ''
        return String(row.getCell(headers[key]).value ?? '').trim()
      }

      const telegramId = cell('telegram_id') || null
      const email      = cell('email') || null

      if (!telegramId && !email) continue // skip empty rows

      try {
        // Find existing user by telegramId or email
        let existingUser = null
        if (telegramId) {
          existingUser = await prisma.user.findUnique({ where: { telegramId } })
        }
        if (!existingUser && email) {
          existingUser = await prisma.user.findUnique({ where: { email } })
        }

        // Prepare data
        const remnawaveUuid = cell('remnawave_uuid') || undefined
        const balance       = cell('balance') ? parseFloat(cell('balance')) : undefined
        const usernameTg    = cell('username_tg') || undefined
        const referralCode  = cell('referral_code') || undefined

        // Sub status
        let subStatus: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'TRIAL' | undefined
        const rawStatus = cell('subscription_status').toUpperCase()
        if (['ACTIVE', 'INACTIVE', 'EXPIRED', 'TRIAL'].includes(rawStatus)) {
          subStatus = rawStatus as typeof subStatus
        }

        // Sub expire date
        let subExpireAt: Date | undefined
        const rawExpire = cell('sub_expire_date')
        if (rawExpire) {
          const m = rawExpire.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
          if (m) {
            subExpireAt = new Date(`${m[3]}-${m[2]}-${m[1]}`)
          } else {
            const d = new Date(rawExpire)
            if (!isNaN(d.getTime())) subExpireAt = d
          }
        }

        const payload: Record<string, any> = {}
        if (remnawaveUuid !== undefined) payload.remnawaveUuid = remnawaveUuid
        if (balance !== undefined && !isNaN(balance)) payload.balance = balance
        if (usernameTg !== undefined) payload.telegramName = usernameTg
        if (subStatus !== undefined)  payload.subStatus = subStatus
        if (subExpireAt !== undefined) payload.subExpireAt = subExpireAt
        if (referralCode !== undefined) payload.referralCode = referralCode

        if (existingUser) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: payload,
          })
          updated++
        } else {
          await prisma.user.create({
            data: {
              telegramId: telegramId || undefined,
              email:      email || undefined,
              ...payload,
            },
          })
          imported++
        }
      } catch (err: any) {
        errors.push(`Row ${rowIdx}: ${err.message ?? err}`)
      }
    }

    return { imported, updated, errors }
  })
}
