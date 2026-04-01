import type { FastifyInstance } from 'fastify'
import ExcelJS from 'exceljs'
import { prisma } from '../db'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'

/* ═══════════════════════════════════════════════════════════════
   Data Import / Export Engine  —  universal import with mapping,
   preview, execute, rollback + Excel export
   ═══════════════════════════════════════════════════════════════ */

const UPLOAD_DIR = '/app/uploads/imports'

// ── Types ────────────────────────────────────────────────────

interface FileRecord {
  fileId: string
  originalName: string
  path: string
  headers: string[]
  sampleRows: string[][]
  rowCount: number
  allRows: string[][]
  autoMapping: Record<string, string>
}

interface MappingFile {
  fileId: string
  type: 'users' | 'payments' | 'transactions'
  mapping: Record<string, string>
  regexRules: { column: string; regex: string; targetField: string; description: string }[]
}

interface LinkRule {
  sourceFile: string
  sourceField: string
  targetFile: string
  targetField: string
  regex?: string
}

interface RollbackAction {
  action: 'create' | 'update'
  table: string
  id: string
  previousData?: any
}

interface ImportSession {
  id: string
  createdAt: string
  status: 'created' | 'files_uploaded' | 'mapped' | 'previewed' | 'executed' | 'rolled_back'
  files: FileRecord[]
  mapping: { files: MappingFile[]; linkRules: LinkRule[] } | null
  preview: any | null
  rollbackData: RollbackAction[]
  stats: any | null
}

// ── In-memory store ──────────────────────────────────────────

const sessions = new Map<string, ImportSession>()

// ── Auto-mapping dictionary ──────────────────────────────────

const FIELD_ALIASES: Record<string, string[]> = {
  // Users
  legacyId:      ['id', 'legacy_id', 'old_id', 'user_id'],
  telegramId:    ['telegram_id', 'tg_id', 'telegram id', 'телеграм id'],
  telegramName:  ['username', 'tg_username', 'имя пользователя', 'ник'],
  name:          ['имя', 'name', 'фио', 'first_name'],
  email:         ['email', 'e-mail', 'почта'],
  phone:         ['телефон', 'phone', 'номер'],
  remnawaveUuid: ['uuid', 'remnawave_uuid', 'vless', 'key', 'ключ'],
  subLink:       ['url_sub', 'sub_url', 'subscription_url', 'ссылка подписки'],
  subStatus:     ['статус', 'status', 'subscription_status', 'статус подписки'],
  balance:       ['balance', 'баланс', 'баланс юзера'],
  referrerId:    ['referrer', 'referrer id', 'ref_id', 'реферер', 'referrer_id'],
  referralCode:  ['referral_code', 'реферальный код', 'ref_code'],
  bonusDays:     ['bonus_days', 'бонусные дни', 'доп дни'],
  totalPaid:     ['total_paid', 'всего оплачено', 'стоимость подписки'],
  utmCode:       ['utm', 'utm_code', 'utm_source'],
  notes:         ['заметки', 'notes', 'теги', 'tags'],
  createdAt:     ['дата создания', 'created_at', 'registered', 'дата регистрации', 'date'],

  // Payments
  amount:        ['amount', 'сумма', 'сумма платежа'],
  amountNet:     ['сумма к зачислению', 'net_amount'],
  status_pay:    ['status', 'статус', 'статус платежа'],
  method:        ['метод платежа', 'payment_method', 'способ оплаты'],
  description:   ['description', 'описание', 'описание заказа'],
  externalId:    ['идентификатор платежа', 'payment_id', 'external_id'],
  paidAt:        ['дата платежа', 'paid_at', 'paid_date'],
  cardNumber:    ['номер карты', 'card_number', 'номер карты плательщика'],
  rrn:           ['rrn', 'rrn операции'],
}

function autoMapColumns(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const header of headers) {
    const lower = header.toLowerCase().trim()
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.some(a => a.toLowerCase() === lower)) {
        result[header] = field
        break
      }
    }
  }
  return result
}

// ── Column type detection ────────────────────────────────────

function detectColumnType(values: string[]): string {
  const samples = values.filter(v => v && v.trim())
  if (samples.length === 0) return 'string'

  const allNumbers = samples.every(v => /^-?\d+([.,]\d+)?$/.test(v.trim()))
  if (allNumbers) return 'number'

  const allEmails = samples.every(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))
  if (allEmails) return 'email'

  const allDates = samples.every(v =>
    /^\d{2}\.\d{2}\.\d{4}/.test(v.trim()) || /^\d{4}-\d{2}-\d{2}/.test(v.trim())
  )
  if (allDates) return 'date'

  const allUuids = samples.every(v =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim())
  )
  if (allUuids) return 'id'

  return 'string'
}

// ── CSV parsing ──────────────────────────────────────────────

function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return []

  // Detect delimiter: semicolon or comma
  const firstLine = lines[0]
  const semicolons = (firstLine.match(/;/g) || []).length
  const commas = (firstLine.match(/,/g) || []).length
  const delimiter = semicolons >= commas ? ';' : ','

  return lines.map(line => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  })
}

// ── Date parsing ─────────────────────────────────────────────

function parseDate(val: string): Date | null {
  if (!val || !val.trim()) return null
  const s = val.trim()

  // DD.MM.YYYY HH:MM:SS
  const ru = s.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (ru) {
    const [, dd, mm, yyyy, hh, min, ss] = ru
    return new Date(+yyyy, +mm - 1, +dd, +(hh || 0), +(min || 0), +(ss || 0))
  }

  // ISO
  const iso = new Date(s)
  if (!isNaN(iso.getTime())) return iso

  return null
}

// ── Excel style helper ───────────────────────────────────────

function styleHeaderRow(ws: ExcelJS.Worksheet) {
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B21A8' } }
  headerRow.alignment = { horizontal: 'center' }
  headerRow.eachCell(cell => {
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF6B21A8' } },
    }
  })
}

// ═════════════════════════════════════════════════════════════
//  ROUTES
// ═════════════════════════════════════════════════════════════

export async function adminDataImportRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  // Ensure upload dir exists
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })

  // ── Sessions ─────────────────────────────────────────────

  // POST /sessions — create
  app.post('/sessions', admin, async () => {
    const id = randomUUID()
    const session: ImportSession = {
      id,
      createdAt: new Date().toISOString(),
      status: 'created',
      files: [],
      mapping: null,
      preview: null,
      rollbackData: [],
      stats: null,
    }
    sessions.set(id, session)
    return { id }
  })

  // GET /sessions — list
  app.get('/sessions', admin, async () => {
    const list = Array.from(sessions.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(s => ({
        id: s.id,
        createdAt: s.createdAt,
        status: s.status,
        filesCount: s.files.length,
      }))
    return list
  })

  // GET /sessions/:id — detail
  app.get<{ Params: { id: string } }>('/sessions/:id', admin, async (req, reply) => {
    const session = sessions.get(req.params.id)
    if (!session) return reply.code(404).send({ error: 'Сессия не найдена' })
    return {
      ...session,
      files: session.files.map(f => ({
        fileId: f.fileId,
        originalName: f.originalName,
        headers: f.headers,
        sampleRows: f.sampleRows,
        rowCount: f.rowCount,
        autoMapping: f.autoMapping,
      })),
    }
  })

  // DELETE /sessions/:id
  app.delete<{ Params: { id: string } }>('/sessions/:id', admin, async (req, reply) => {
    const session = sessions.get(req.params.id)
    if (!session) return reply.code(404).send({ error: 'Сессия не найдена' })

    // Cleanup files
    for (const f of session.files) {
      try { fs.unlinkSync(f.path) } catch {}
    }
    sessions.delete(req.params.id)
    return { ok: true }
  })

  // ── File Upload ──────────────────────────────────────────

  app.post<{ Params: { id: string } }>('/sessions/:id/files', admin, async (req, reply) => {
    const session = sessions.get(req.params.id)
    if (!session) return reply.code(404).send({ error: 'Сессия не найдена' })

    const file = await req.file()
    if (!file) return reply.code(400).send({ error: 'Файл не прикреплён' })

    const fileId = randomUUID()
    const ext = path.extname(file.filename).toLowerCase()
    const filePath = path.join(UPLOAD_DIR, `${fileId}${ext}`)

    // Save to disk
    const ws = fs.createWriteStream(filePath)
    await pipeline(file.file, ws)

    let headers: string[] = []
    let allRows: string[][] = []

    if (ext === '.csv' || ext === '.txt') {
      const content = fs.readFileSync(filePath, 'utf-8')
      const rows = parseCSV(content)
      if (rows.length > 0) {
        headers = rows[0]
        allRows = rows.slice(1)
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.readFile(filePath)
      const sheet = wb.worksheets[0]
      if (sheet) {
        const rawRows: string[][] = []
        sheet.eachRow((row, idx) => {
          const vals = (row.values as any[]).slice(1).map(v => {
            if (v instanceof Date) return v.toISOString()
            if (v && typeof v === 'object' && v.result !== undefined) return String(v.result)
            return v != null ? String(v) : ''
          })
          rawRows.push(vals)
        })
        if (rawRows.length > 0) {
          headers = rawRows[0]
          allRows = rawRows.slice(1)
        }
      }
    } else {
      fs.unlinkSync(filePath)
      return reply.code(400).send({ error: 'Неподдерживаемый формат. Используйте CSV или XLSX' })
    }

    const sampleRows = allRows.slice(0, 5)
    const autoMapping = autoMapColumns(headers)

    // Detect column types from sample data
    const columnTypes: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) {
      const colValues = sampleRows.map(r => r[i] || '')
      columnTypes[headers[i]] = detectColumnType(colValues)
    }

    const fileRecord: FileRecord = {
      fileId,
      originalName: file.filename,
      path: filePath,
      headers,
      sampleRows,
      rowCount: allRows.length,
      allRows,
      autoMapping,
    }

    session.files.push(fileRecord)
    session.status = 'files_uploaded'

    return {
      fileId,
      originalName: file.filename,
      headers,
      sampleRows,
      rowCount: allRows.length,
      columnTypes,
      autoMapping,
    }
  })

  // ── Mapping ──────────────────────────────────────────────

  app.put<{ Params: { id: string }; Body: { files: MappingFile[]; linkRules: LinkRule[] } }>(
    '/sessions/:id/mapping',
    admin,
    async (req, reply) => {
      const session = sessions.get(req.params.id)
      if (!session) return reply.code(404).send({ error: 'Сессия не найдена' })

      const body = req.body as any
      session.mapping = {
        files: body.files || [],
        linkRules: body.linkRules || body.crossLinks || [],
      }
      if (body.extractors) {
        (session.mapping as any).extractors = body.extractors
      }
      session.status = 'mapped'
      return { ok: true }
    },
  )

  // ── Preview (Dry Run) ────────────────────────────────────

  app.post<{ Params: { id: string } }>('/sessions/:id/preview', admin, async (req, reply) => {
    const session = sessions.get(req.params.id)
    if (!session) return reply.code(404).send({ error: 'Сессия не найдена' })
    if (!session.mapping) return reply.code(400).send({ error: 'Сначала настройте маппинг' })

    try {
      const result = await runImport(session, true)
      // Ensure safe structure
      const ru = result?.users || {}
      const rp = result?.payments || {}
      const rr = result?.referrals || {}
      const safe = {
        users: { create: ru.create || 0, update: ru.update || 0, skip: ru.skip || 0, samples: ru.samples || [] },
        payments: { create: rp.create || 0, link: rp.link || 0, noLink: rp.noLink || 0, samples: rp.samples || [] },
        referrals: { link: rr.link || 0 },
        errors: result?.errors || [],
      }
      session.preview = safe
      session.status = 'previewed'
      return safe
    } catch (err: any) {
      console.error('Preview error:', err)
      return {
        users: { create: 0, update: 0, skip: 0, samples: [] },
        payments: { create: 0, link: 0, noLink: 0, samples: [] },
        referrals: { link: 0 },
        errors: [`Ошибка: ${err.message}`],
      }
    }
  })

  // ── Execute ──────────────────────────────────────────────

  app.post<{ Params: { id: string } }>('/sessions/:id/execute', admin, async (req, reply) => {
    const session = sessions.get(req.params.id)
    if (!session) return reply.code(404).send({ error: 'Сессия не найдена' })
    if (!session.mapping) return reply.code(400).send({ error: 'Сначала настройте маппинг' })
    if (session.status === 'executed') {
      return reply.code(400).send({ error: 'Импорт уже выполнен. Создайте новую сессию или откатите' })
    }

    try {
      const result = await runImport(session, false)
      session.stats = result
      session.status = 'executed'
      return { stats: result, rollbackId: session.id }
    } catch (err: any) {
      return reply.code(500).send({ error: `Ошибка импорта: ${err.message}` })
    }
  })

  // ── Rollback ─────────────────────────────────────────────

  app.post<{ Params: { id: string } }>('/sessions/:id/rollback', admin, async (req, reply) => {
    const session = sessions.get(req.params.id)
    if (!session) return reply.code(404).send({ error: 'Сессия не найдена' })
    if (session.status !== 'executed') {
      return reply.code(400).send({ error: 'Нечего откатывать — импорт не был выполнен' })
    }

    let rolled = 0
    let errors: string[] = []

    // Process in reverse order
    for (const action of [...session.rollbackData].reverse()) {
      try {
        if (action.action === 'create') {
          // Delete created record
          if (action.table === 'user') {
            await prisma.user.delete({ where: { id: action.id } }).catch(() => {})
          } else if (action.table === 'payment') {
            await prisma.payment.delete({ where: { id: action.id } }).catch(() => {})
          }
          rolled++
        } else if (action.action === 'update' && action.previousData) {
          if (action.table === 'user') {
            await prisma.user.update({ where: { id: action.id }, data: action.previousData })
          } else if (action.table === 'payment') {
            await prisma.payment.update({ where: { id: action.id }, data: action.previousData })
          }
          rolled++
        }
      } catch (err: any) {
        errors.push(`Ошибка отката ${action.table}/${action.id}: ${err.message}`)
      }
    }

    session.status = 'rolled_back'
    session.rollbackData = []

    return { rolled, errors }
  })

  // ── Regex Test ───────────────────────────────────────────

  app.post<{ Body: { regex: string; samples: string[] } }>(
    '/regex-test',
    admin,
    async (req, reply) => {
      const { regex, samples } = req.body
      if (!regex || !samples) return reply.code(400).send({ error: 'Укажите regex и samples' })

      try {
        const re = new RegExp(regex)
        const matches = samples.map(input => {
          const m = input.match(re)
          return {
            input,
            output: m ? (m[1] || m[0]) : null,
            matched: !!m,
          }
        })
        return { matches }
      } catch (err: any) {
        return reply.code(400).send({ error: `Невалидный regex: ${err.message}` })
      }
    },
  )

  // ── Export ───────────────────────────────────────────────

  // GET /export/users
  app.get('/export/users', admin, async (_req, reply) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { referredBy: { select: { telegramId: true, telegramName: true } } },
    })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Пользователи')

    ws.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Telegram ID', key: 'telegramId', width: 16 },
      { header: 'Username', key: 'telegramName', width: 20 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Роль', key: 'role', width: 10 },
      { header: 'Баланс', key: 'balance', width: 12 },
      { header: 'Всего оплат', key: 'totalPaid', width: 14 },
      { header: 'Кол-во платежей', key: 'paymentsCount', width: 16 },
      { header: 'Подписка', key: 'subStatus', width: 12 },
      { header: 'Remnawave UUID', key: 'remnawaveUuid', width: 36 },
      { header: 'Реферер', key: 'referredBy', width: 20 },
      { header: 'Реферальный код', key: 'referralCode', width: 20 },
      { header: 'Источник', key: 'source', width: 14 },
      { header: 'Создан', key: 'createdAt', width: 22 },
    ]

    for (const u of users) {
      ws.addRow({
        id: u.id,
        telegramId: u.telegramId,
        telegramName: u.telegramName,
        email: u.email,
        role: u.role,
        balance: Number(u.balance),
        totalPaid: Number(u.totalPaid),
        paymentsCount: u.paymentsCount,
        subStatus: u.subStatus,
        remnawaveUuid: u.remnawaveUuid,
        referredBy: u.referredBy ? (u.referredBy.telegramName || u.referredBy.telegramId) : '',
        referralCode: u.referralCode,
        source: u.source,
        createdAt: u.createdAt.toISOString(),
      })
    }

    styleHeaderRow(ws)

    const buf = await wb.xlsx.writeBuffer()
    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="users_${Date.now()}.xlsx"`)
      .send(Buffer.from(buf as ArrayBuffer))
  })

  // GET /export/payments
  app.get('/export/payments', admin, async (_req, reply) => {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { telegramId: true, telegramName: true, email: true } },
        tariff: { select: { name: true } },
      },
    })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Платежи')

    ws.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Telegram ID', key: 'telegramId', width: 16 },
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Сумма', key: 'amount', width: 12 },
      { header: 'Валюта', key: 'currency', width: 10 },
      { header: 'Статус', key: 'status', width: 12 },
      { header: 'Провайдер', key: 'provider', width: 14 },
      { header: 'Назначение', key: 'purpose', width: 14 },
      { header: 'Тариф', key: 'tariff', width: 20 },
      { header: 'Описание', key: 'description', width: 30 },
      { header: 'Оплачен', key: 'paidAt', width: 22 },
      { header: 'Создан', key: 'createdAt', width: 22 },
    ]

    for (const p of payments) {
      ws.addRow({
        id: p.id,
        telegramId: p.user.telegramId,
        username: p.user.telegramName,
        email: p.user.email,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        purpose: p.purpose,
        tariff: p.tariff?.name || '',
        description: p.description,
        paidAt: p.paidAt?.toISOString() || '',
        createdAt: p.createdAt.toISOString(),
      })
    }

    styleHeaderRow(ws)

    const buf = await wb.xlsx.writeBuffer()
    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="payments_${Date.now()}.xlsx"`)
      .send(Buffer.from(buf as ArrayBuffer))
  })

  // GET /export/transactions
  app.get('/export/transactions', admin, async (_req, reply) => {
    const txns = await prisma.transaction.findMany({
      orderBy: { date: 'desc' },
      include: {
        category: { select: { name: true } },
        createdBy: { select: { telegramName: true } },
      },
    })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Транзакции')

    ws.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Тип', key: 'type', width: 12 },
      { header: 'Сумма', key: 'amount', width: 12 },
      { header: 'Дата', key: 'date', width: 14 },
      { header: 'Категория', key: 'category', width: 20 },
      { header: 'Описание', key: 'description', width: 36 },
      { header: 'Создал', key: 'createdBy', width: 20 },
      { header: 'Создан', key: 'createdAt', width: 22 },
    ]

    for (const t of txns) {
      ws.addRow({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        date: t.date.toISOString().slice(0, 10),
        category: t.category?.name || '',
        description: t.description,
        createdBy: t.createdBy?.telegramName || '',
        createdAt: t.createdAt.toISOString(),
      })
    }

    styleHeaderRow(ws)

    const buf = await wb.xlsx.writeBuffer()
    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="transactions_${Date.now()}.xlsx"`)
      .send(Buffer.from(buf as ArrayBuffer))
  })

  // GET /export/full — all in one workbook
  app.get('/export/full', admin, async (_req, reply) => {
    const [users, payments, transactions] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: { referredBy: { select: { telegramId: true, telegramName: true } } },
      }),
      prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { telegramId: true, telegramName: true, email: true } },
          tariff: { select: { name: true } },
        },
      }),
      prisma.transaction.findMany({
        orderBy: { date: 'desc' },
        include: {
          category: { select: { name: true } },
          createdBy: { select: { telegramName: true } },
        },
      }),
    ])

    const wb = new ExcelJS.Workbook()

    // Sheet 1: Users
    const wsU = wb.addWorksheet('Пользователи')
    wsU.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Telegram ID', key: 'telegramId', width: 16 },
      { header: 'Username', key: 'telegramName', width: 20 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Роль', key: 'role', width: 10 },
      { header: 'Баланс', key: 'balance', width: 12 },
      { header: 'Всего оплат', key: 'totalPaid', width: 14 },
      { header: 'Подписка', key: 'subStatus', width: 12 },
      { header: 'Remnawave UUID', key: 'remnawaveUuid', width: 36 },
      { header: 'Реферер', key: 'referredBy', width: 20 },
      { header: 'Создан', key: 'createdAt', width: 22 },
    ]
    for (const u of users) {
      wsU.addRow({
        id: u.id,
        telegramId: u.telegramId,
        telegramName: u.telegramName,
        email: u.email,
        role: u.role,
        balance: Number(u.balance),
        totalPaid: Number(u.totalPaid),
        subStatus: u.subStatus,
        remnawaveUuid: u.remnawaveUuid,
        referredBy: u.referredBy ? (u.referredBy.telegramName || u.referredBy.telegramId) : '',
        createdAt: u.createdAt.toISOString(),
      })
    }
    styleHeaderRow(wsU)

    // Sheet 2: Payments
    const wsP = wb.addWorksheet('Платежи')
    wsP.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Telegram ID', key: 'telegramId', width: 16 },
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Сумма', key: 'amount', width: 12 },
      { header: 'Валюта', key: 'currency', width: 10 },
      { header: 'Статус', key: 'status', width: 12 },
      { header: 'Провайдер', key: 'provider', width: 14 },
      { header: 'Тариф', key: 'tariff', width: 20 },
      { header: 'Описание', key: 'description', width: 30 },
      { header: 'Оплачен', key: 'paidAt', width: 22 },
      { header: 'Создан', key: 'createdAt', width: 22 },
    ]
    for (const p of payments) {
      wsP.addRow({
        id: p.id,
        telegramId: p.user.telegramId,
        username: p.user.telegramName,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        tariff: p.tariff?.name || '',
        description: p.description,
        paidAt: p.paidAt?.toISOString() || '',
        createdAt: p.createdAt.toISOString(),
      })
    }
    styleHeaderRow(wsP)

    // Sheet 3: Transactions
    const wsT = wb.addWorksheet('Транзакции')
    wsT.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Тип', key: 'type', width: 12 },
      { header: 'Сумма', key: 'amount', width: 12 },
      { header: 'Дата', key: 'date', width: 14 },
      { header: 'Категория', key: 'category', width: 20 },
      { header: 'Описание', key: 'description', width: 36 },
      { header: 'Создан', key: 'createdAt', width: 22 },
    ]
    for (const t of transactions) {
      wsT.addRow({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        date: t.date.toISOString().slice(0, 10),
        category: t.category?.name || '',
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })
    }
    styleHeaderRow(wsT)

    const buf = await wb.xlsx.writeBuffer()
    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="hideyou_full_${Date.now()}.xlsx"`)
      .send(Buffer.from(buf as ArrayBuffer))
  })
}

// ═════════════════════════════════════════════════════════════
//  IMPORT ENGINE
// ═════════════════════════════════════════════════════════════

async function runImport(session: ImportSession, dryRun: boolean) {
  const mapping = session.mapping!
  const errors: string[] = []

  // Maps: legacyId → db user id
  const legacyToDbId = new Map<string, string>()
  // Maps: legacyId → user object (for linking)
  const legacyToUser = new Map<string, any>()

  const rollbackData: RollbackAction[] = []

  const stats = {
    users: { create: 0, update: 0, skip: 0, samples: [] as any[] },
    payments: { create: 0, link: 0, noLink: 0, samples: [] as any[] },
    referrals: { link: 0 },
    errors: errors,
  }

  // ── Process each mapped file ────────────────────────────

  for (const fileCfg of mapping.files) {
    const cfgId = (fileCfg as any).fileId || (fileCfg as any).id
    const fileRecord = session.files.find(f => f.fileId === cfgId)
    if (!fileRecord) {
      errors.push(`Файл ${cfgId} не найден в сессии`)
      continue
    }

    const { headers } = fileRecord
    const rows = fileRecord.allRows

    // Build column index map: systemField → column index
    const colMap = new Map<string, number>()
    for (const [colName, sysField] of Object.entries(fileCfg.mapping)) {
      const idx = headers.indexOf(colName)
      if (idx >= 0) colMap.set(sysField, idx)
    }

    // Helper: get value from row by system field
    function getVal(row: string[], field: string): string {
      const idx = colMap.get(field)
      if (idx === undefined) return ''
      return (row[idx] || '').trim()
    }

    // Helper: apply regex rules to extract additional fields
    function applyRegex(row: string[]): Record<string, string> {
      const extracted: Record<string, string> = {}
      for (const rule of fileCfg.regexRules || []) {
        const colIdx = headers.indexOf(rule.column)
        if (colIdx < 0) continue
        const val = row[colIdx] || ''
        try {
          const re = new RegExp(rule.regex)
          const m = val.match(re)
          if (m) {
            extracted[rule.targetField] = m[1] || m[0]
          }
        } catch {}
      }
      return extracted
    }

    // ── USERS ──────────────────────────────────────────────

    if (fileCfg.type === 'users') {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const regexFields = applyRegex(row)

        const telegramId = regexFields.telegramId || getVal(row, 'telegramId') || null
        const email = regexFields.email || getVal(row, 'email') || null
        const telegramName = regexFields.telegramName || getVal(row, 'telegramName') || null
        const remnawaveUuid = regexFields.remnawaveUuid || getVal(row, 'remnawaveUuid') || null
        const balanceStr = regexFields.balance || getVal(row, 'balance')
        const balance = balanceStr ? parseFloat(balanceStr.replace(',', '.')) : undefined
        const legacyId = regexFields.legacyId || getVal(row, 'legacyId') || null
        const referrerId = regexFields.referrerId || getVal(row, 'referrerId') || null
        const dateStr = regexFields.date || getVal(row, 'date')
        const createdAt = parseDate(dateStr) || undefined

        if (!telegramId && !email) {
          errors.push(`Строка ${i + 2}: нет telegram_id или email — пропущена`)
          stats.users.skip++
          continue
        }

        // Find existing user by telegramId, email, or remnawaveUuid
        let existingUser = null as any
        if (telegramId) {
          existingUser = await prisma.user.findUnique({ where: { telegramId } })
        }
        if (!existingUser && email) {
          existingUser = await prisma.user.findUnique({ where: { email } })
        }
        if (!existingUser && remnawaveUuid) {
          existingUser = await prisma.user.findFirst({ where: { remnawaveUuid } })
        }

        const userData: any = {}
        if (telegramId) userData.telegramId = telegramId
        if (email) userData.email = email
        if (telegramName) userData.telegramName = telegramName
        if (remnawaveUuid) userData.remnawaveUuid = remnawaveUuid
        if (balance !== undefined && !isNaN(balance)) userData.balance = balance
        if (createdAt) userData.createdAt = createdAt

        if (dryRun) {
          if (existingUser) {
            stats.users.update++
            if (legacyId) legacyToDbId.set(legacyId, existingUser.id)
          } else {
            stats.users.create++
            if (legacyId) legacyToDbId.set(legacyId, `new_${i}`)
          }

          if (stats.users.samples.length < 5) {
            stats.users.samples.push({
              action: existingUser ? 'update' : 'create',
              telegramId,
              email,
              telegramName,
              balance,
            })
          }

          // Store referrer for second pass
          if (legacyId && referrerId) {
            legacyToUser.set(legacyId, { referrerId })
          }
        } else {
          // Real import
          if (existingUser) {
            // Save previous data for rollback
            const prevData: any = {}
            for (const key of Object.keys(userData)) {
              prevData[key] = (existingUser as any)[key]
            }
            rollbackData.push({ action: 'update', table: 'user', id: existingUser.id, previousData: prevData })

            await prisma.user.update({ where: { id: existingUser.id }, data: userData })
            stats.users.update++
            if (legacyId) legacyToDbId.set(legacyId, existingUser.id)
          } else {
            try {
              const newUser = await prisma.user.create({ data: userData })
              rollbackData.push({ action: 'create', table: 'user', id: newUser.id })
              stats.users.create++
              if (legacyId) legacyToDbId.set(legacyId, newUser.id)
            } catch (e: any) {
              errors.push(`Строка ${i + 2}: ${e.message?.includes('Unique') ? 'Дубликат (уже существует)' : e.message?.substring(0, 80)}`)
              stats.users.skip++
            }
          }

          if (legacyId && referrerId) {
            legacyToUser.set(legacyId, { referrerId })
          }
        }
      }
    }

    // ── PAYMENTS ───────────────────────────────────────────

    if (fileCfg.type === 'payments') {
      // Apply link rules to find user ID column
      const linkRule = mapping.linkRules.find(
        r => r.targetFile === fileCfg.fileId || r.sourceFile === fileCfg.fileId,
      )

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const regexFields = applyRegex(row)

        const amountStr = regexFields.amount || getVal(row, 'amount')
        const amount = amountStr ? parseFloat(amountStr.replace(',', '.').replace(/\s/g, '')) : 0
        const dateStr = regexFields.date || getVal(row, 'date')
        const payDate = parseDate(dateStr) || new Date()
        const status = regexFields.status || getVal(row, 'status') || 'PAID'
        const description = regexFields.description || getVal(row, 'description') || ''

        // Try to find the user
        let userId: string | null = null

        // 1. Direct telegramId in payment row
        const tgId = regexFields.telegramId || getVal(row, 'telegramId')
        if (tgId) {
          const u = await prisma.user.findUnique({ where: { telegramId: tgId } })
          if (u) userId = u.id
        }

        // 2. LegacyId mapping
        if (!userId) {
          const legId = regexFields.legacyId || getVal(row, 'legacyId')
          if (legId && legacyToDbId.has(legId)) {
            userId = legacyToDbId.get(legId)!
          }
        }

        // 3. Link rule with regex on description
        if (!userId && linkRule?.regex) {
          try {
            const re = new RegExp(linkRule.regex)
            const sourceVal = getVal(row, linkRule.sourceField) || description
            const m = sourceVal.match(re)
            if (m) {
              const extractedId = m[1] || m[0]
              // Try as legacyId
              if (legacyToDbId.has(extractedId)) {
                userId = legacyToDbId.get(extractedId)!
              }
              // Try as telegramId
              if (!userId) {
                const u = await prisma.user.findUnique({ where: { telegramId: extractedId } })
                if (u) userId = u.id
              }
            }
          } catch {}
        }

        // Map status string to enum
        const statusMap: Record<string, string> = {
          'оплачен': 'PAID', 'paid': 'PAID', 'успешно': 'PAID',
          'ожидание': 'PENDING', 'pending': 'PENDING',
          'ошибка': 'FAILED', 'failed': 'FAILED',
          'возврат': 'REFUNDED', 'refunded': 'REFUNDED',
        }
        const normalizedStatus = statusMap[status.toLowerCase()] || status.toUpperCase()
        const validStatuses = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'EXPIRED']
        const finalStatus = validStatuses.includes(normalizedStatus) ? normalizedStatus : 'PAID'

        if (dryRun) {
          if (userId || (tgId && !userId)) {
            if (userId) {
              stats.payments.create++
              stats.payments.link++
            } else {
              stats.payments.create++
              stats.payments.noLink++
            }
          } else {
            stats.payments.noLink++
            stats.payments.create++
          }

          if (stats.payments.samples.length < 5) {
            stats.payments.samples.push({
              amount,
              date: payDate.toISOString(),
              status: finalStatus,
              description: description.slice(0, 60),
              linked: !!userId,
            })
          }
        } else {
          if (!userId) {
            stats.payments.noLink++
            errors.push(`Платёж строка ${i + 2}: пользователь не найден — пропущен`)
            continue
          }

          const payment = await prisma.payment.create({
            data: {
              userId,
              amount,
              currency: 'RUB',
              status: finalStatus as any,
              provider: 'MANUAL' as any,
              purpose: 'SUBSCRIPTION' as any,
              description: description || null,
              paidAt: finalStatus === 'PAID' ? payDate : null,
              createdAt: payDate,
            },
          })
          rollbackData.push({ action: 'create', table: 'payment', id: payment.id })
          stats.payments.create++
          stats.payments.link++
        }
      }
    }

    // ── TRANSACTIONS (accounting) ──────────────────────────

    if (fileCfg.type === 'transactions') {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const regexFields = applyRegex(row)

        const amountStr = regexFields.amount || getVal(row, 'amount')
        const amount = amountStr ? parseFloat(amountStr.replace(',', '.').replace(/\s/g, '')) : 0
        const dateStr = regexFields.date || getVal(row, 'date')
        const date = parseDate(dateStr) || new Date()
        const description = regexFields.description || getVal(row, 'description') || ''
        const typeStr = (regexFields.type || getVal(row, 'type') || 'INCOME').toUpperCase()
        const type = typeStr === 'EXPENSE' ? 'EXPENSE' : 'INCOME'

        if (dryRun) {
          // Count only for preview
          stats.payments.create++ // reuse counter for simplicity
        } else {
          const txn = await prisma.transaction.create({
            data: {
              type: type as any,
              amount,
              date,
              description: description || null,
              isHistorical: true,
            },
          })
          rollbackData.push({ action: 'create', table: 'transaction', id: txn.id })
        }
      }
    }
  }

  // ── Second pass: referrals ──────────────────────────────

  if (!dryRun) {
    for (const [legacyId, data] of legacyToUser.entries()) {
      if (data.referrerId) {
        const userId = legacyToDbId.get(legacyId)
        const referrerId = legacyToDbId.get(data.referrerId)
        if (userId && referrerId && userId !== referrerId) {
          try {
            const user = await prisma.user.findUnique({ where: { id: userId } })
            if (user && !user.referredById) {
              rollbackData.push({
                action: 'update',
                table: 'user',
                id: userId,
                previousData: { referredById: null },
              })
              await prisma.user.update({
                where: { id: userId },
                data: { referredById: referrerId },
              })
              stats.referrals.link++
            }
          } catch (err: any) {
            errors.push(`Реферал ${legacyId} → ${data.referrerId}: ${err.message}`)
          }
        }
      }
    }
  } else {
    // Dry run: count referrals
    for (const [legacyId, data] of legacyToUser.entries()) {
      if (data.referrerId && legacyToDbId.has(data.referrerId)) {
        stats.referrals.link++
      }
    }
  }

  // Save rollback data
  if (!dryRun) {
    session.rollbackData = rollbackData
  }

  return stats
}
