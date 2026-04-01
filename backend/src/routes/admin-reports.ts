import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db'
import ExcelJS from 'exceljs'

export async function adminReportRoutes(app: FastifyInstance) {
  const admin = { preHandler: [app.adminOnly] }

  // POST /data — get report data for date range (JSON)
  app.post('/data', admin, async (req) => {
    const body = z.object({
      dateFrom: z.string(),
      dateTo:   z.string(),
    }).parse(req.body)

    const from = new Date(body.dateFrom)
    const to   = new Date(body.dateTo)
    to.setHours(23, 59, 59, 999)

    const [
      incomeAgg, expenseAgg, payments, transactions,
      topCategories, userCount, paymentCount,
    ] = await Promise.all([
      prisma.transaction.aggregate({ where: { type: 'INCOME', date: { gte: from, lte: to } }, _sum: { amount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { type: 'EXPENSE', date: { gte: from, lte: to } }, _sum: { amount: true }, _count: true }),
      prisma.payment.aggregate({ where: { status: 'PAID', paidAt: { gte: from, lte: to } }, _sum: { amount: true }, _count: true }),
      prisma.transaction.findMany({
        where: { date: { gte: from, lte: to } },
        include: { category: { select: { name: true, color: true } } },
        orderBy: { date: 'desc' },
        take: 200,
      }),
      prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { date: { gte: from, lte: to }, categoryId: { not: null } },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      }),
      prisma.user.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.payment.count({ where: { status: 'PAID', paidAt: { gte: from, lte: to } } }),
    ])

    const catIds = topCategories.map(c => c.categoryId!).filter(Boolean)
    const cats = await prisma.category.findMany({ where: { id: { in: catIds } }, select: { id: true, name: true, color: true } })
    const catMap = new Map(cats.map(c => [c.id, c]))

    return {
      period: { from: body.dateFrom, to: body.dateTo },
      summary: {
        income:     Number(incomeAgg._sum.amount || 0),
        expense:    Number(expenseAgg._sum.amount || 0),
        profit:     Number(incomeAgg._sum.amount || 0) - Number(expenseAgg._sum.amount || 0),
        revenue:    Number(payments._sum.amount || 0),
        incomeCount: incomeAgg._count,
        expenseCount: expenseAgg._count,
        newUsers:    userCount,
        paidPayments: paymentCount,
      },
      topCategories: topCategories.map(c => ({
        category: catMap.get(c.categoryId!) || { name: 'Без категории', color: '#999' },
        amount:   Number(c._sum.amount || 0),
        count:    c._count,
      })),
      transactions: transactions.map(t => ({
        id:          t.id,
        type:        t.type,
        amount:      Number(t.amount),
        date:        t.date,
        description: t.description,
        category:    t.category,
      })),
    }
  })

  // POST /excel — generate Excel report
  app.post('/excel', admin, async (req, reply) => {
    const body = z.object({ dateFrom: z.string(), dateTo: z.string() }).parse(req.body)
    const from = new Date(body.dateFrom)
    const to = new Date(body.dateTo)
    to.setHours(23, 59, 59, 999)

    const transactions = await prisma.transaction.findMany({
      where: { date: { gte: from, lte: to } },
      include: { category: { select: { name: true } }, createdBy: { select: { telegramName: true } } },
      orderBy: { date: 'desc' },
    })

    const wb = new ExcelJS.Workbook()
    wb.creator = 'HIDEYOU PRO'

    // Transactions sheet
    const ws = wb.addWorksheet('Транзакции')
    ws.columns = [
      { header: 'Дата', key: 'date', width: 14 },
      { header: 'Тип', key: 'type', width: 10 },
      { header: 'Сумма', key: 'amount', width: 14 },
      { header: 'Категория', key: 'category', width: 20 },
      { header: 'Описание', key: 'description', width: 40 },
      { header: 'Автор', key: 'author', width: 20 },
    ]

    // Header style
    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF534AB7' } }
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }

    for (const t of transactions) {
      ws.addRow({
        date: new Date(t.date).toLocaleDateString('ru'),
        type: t.type === 'INCOME' ? 'Доход' : 'Расход',
        amount: Number(t.amount),
        category: t.category?.name || '—',
        description: t.description || '',
        author: t.createdBy?.telegramName || '—',
      })
    }

    // Summary sheet
    const ss = wb.addWorksheet('Сводка')
    const income = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0)
    const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0)

    ss.addRow(['Период', `${body.dateFrom} — ${body.dateTo}`])
    ss.addRow(['Доход', income])
    ss.addRow(['Расход', expense])
    ss.addRow(['Прибыль', income - expense])
    ss.addRow(['Транзакций', transactions.length])
    ss.getColumn(1).font = { bold: true }
    ss.getColumn(1).width = 20
    ss.getColumn(2).width = 30

    const buffer = await wb.xlsx.writeBuffer()

    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="report_${body.dateFrom}_${body.dateTo}.xlsx"`)
      .send(Buffer.from(buffer as ArrayBuffer))
  })
}
