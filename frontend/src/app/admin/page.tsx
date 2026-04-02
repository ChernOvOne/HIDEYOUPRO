'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Users, CreditCard, DollarSign, Activity,
  Wallet, ArrowUpRight, ArrowDownRight, Loader2, Percent, Download,
  Cpu, HardDrive, Clock, Wifi, WifiOff, Calendar, FileSpreadsheet,
  ChevronDown, ChevronUp, Filter, Target, Megaphone, Zap,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import toast from 'react-hot-toast'
import { api, adminApi } from '@/lib/api'

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface Stats {
  users:        { total: number; active: number; withPayment: number }
  today:        { revenue: number; registrations: number; regWeb: number; regBot: number }
  payments:     { total: number; paid: number; revenue: number }
  accounting:   { income: number; expenses: number; transactions: number }
  partners:     number
  revenueChart: Array<{ date: string; amount: number }>
  weekTrend:    number
  conversion:   number
  remnawave:    RemnawaveData | null
  recentPayments:      Array<{ id: number; amount: number; currency: string; provider: string; paidAt: string; userName: string; tariffName: string }>
  recentTransactions:  Array<{ id: number; type: string; amount: number; date: string; description: string; categoryName: string; categoryColor: string }>
  tariffBreakdown:     Array<{ name: string; count: number; revenue: number }>
  milestones:          Array<{ id: number; name: string; targetAmount: number; currentAmount: number; type: string }>
  campaigns:           Array<{ id: number; name: string; format: string; amount: number; subscribers: number; cps: number }>
}

interface AnalyticsData {
  kpi:     { revenue: number; expenses: number; profit: number; newUsers: number; activeUsers: number; paidPayments: number }
  charts:  { dailyRevenue: any[]; dailyUsers: any[] }
  topTariffs:        Array<{ name: string; count: number; revenue: number }>
  categoryBreakdown: Array<{ category: { name: string; color: string }; type: string; amount: number }>
}

interface RemnawaveData {
  cpu?:    { cores: number }
  memory?: { used: number; total: number }
  uptime?: number
  users?:  { totalUsers: number; statusCounts?: Record<string, number> }
  onlineStats?: { onlineNow: number; lastDay: number; lastWeek: number; neverOnline: number }
  nodes?: any
}

/* ═══════════════════════════════════════════════════════════
   COLORS & HELPERS
   ═══════════════════════════════════════════════════════════ */

const C = {
  primary: '#6366f1', success: '#10b981', warning: '#f59e0b',
  danger: '#ef4444', blue: '#3b82f6', purple: '#8b5cf6',
}

const fmtK = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
const fmtMb = (b: number) => Math.round(b / 1024 / 1024).toLocaleString('ru')
const fmtUp = (s: number) => { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600); return d > 0 ? `${d}д ${h}ч` : `${h}ч ${Math.floor((s % 3600) / 60)}м` }
const fmtTb = (b: any) => { const n = typeof b === 'string' ? parseFloat(b) : b; if (!n) return '---'; const tb = n / (1024 ** 4); return tb >= 1 ? `${tb.toFixed(1)} ТБ` : `${(n / (1024 ** 3)).toFixed(0)} ГБ` }
const fmtRub = (v: number) => `${(v || 0).toLocaleString('ru')} ₽`
const fmtShortDate = (d: string) => { try { const dt = new Date(d); return `${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, '0')}` } catch { return d } }

/* ═══════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const [stats, setStats]     = useState<Stats | null>(null)
  const [anData, setAnData]   = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays]       = useState(30)

  // Report builder
  const [reportOpen, setReportOpen] = useState(false)
  const [dateFrom, setDateFrom]     = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [dateTo, setDateTo]         = useState(new Date().toISOString().split('T')[0])
  const [generating, setGenerating] = useState<string | null>(null)
  const [reportSections, setReportSections] = useState({
    transactions: true, payments: true, users: true, categories: true, partners: false, servers: false,
  })

  // Bonus days modal
  const [showGrant, setShowGrant]       = useState(false)
  const [grantDays, setGrantDays]       = useState(7)
  const [grantDesc, setGrantDesc]       = useState('')
  const [grantLoading, setGrantLoading] = useState(false)

  // Charts expanded
  const [chartsExpanded, setChartsExpanded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, an] = await Promise.all([
        api.stats(),
        fetch(`/api/admin/analytics/overview?days=${days}`, { credentials: 'include' }).then(r => r.json()).catch(() => null),
      ])
      setStats(s)
      setAnData(an)
    } catch {}
    setLoading(false)
  }, [days])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>
  if (!stats) return null

  const kpi = anData?.kpi || { revenue: stats.accounting.income, expenses: stats.accounting.expenses, profit: stats.accounting.income - stats.accounting.expenses, newUsers: 0, activeUsers: stats.users.active, paidPayments: stats.payments.paid }
  const charts = anData?.charts || { dailyRevenue: stats.revenueChart || [], dailyUsers: [] }
  const topTariffs = anData?.topTariffs || []
  const categoryBreakdown = anData?.categoryBreakdown || []
  const rmw = stats.remnawave

  // Chart data
  const dailyRev = charts.dailyRevenue || []
  const totalRev = dailyRev.reduce((s: number, d: any) => s + Number(d.amount || 0), 0)
  const avgDaily = dailyRev.length > 0 ? totalRev / dailyRev.length : 0
  const weekTrend = stats.weekTrend || 0
  const convRate = stats.conversion || (stats.users.total > 0 ? Math.round((stats.users.active / stats.users.total) * 100) : 0)

  // Report builder helpers
  const quickPeriod = (type: string) => {
    const n = new Date()
    if (type === 'today') { setDateFrom(n.toISOString().split('T')[0]); setDateTo(n.toISOString().split('T')[0]) }
    if (type === 'month') { setDateFrom(new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]); setDateTo(n.toISOString().split('T')[0]) }
    if (type === 'year')  { setDateFrom(new Date(n.getFullYear(), 0, 1).toISOString().split('T')[0]); setDateTo(n.toISOString().split('T')[0]) }
  }

  const downloadReport = async (format: 'excel' | 'json') => {
    setGenerating(format)
    try {
      const endpoint = format === 'excel' ? '/api/admin/reports/excel' : '/api/admin/reports/data'
      const res = await fetch(endpoint, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateFrom, dateTo }),
      })
      if (format === 'excel') {
        if (!res.ok) throw new Error()
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `report_${dateFrom}_${dateTo}.xlsx`; a.click()
        URL.revokeObjectURL(url)
      } else {
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `report_${dateFrom}_${dateTo}.json`; a.click()
        URL.revokeObjectURL(url)
      }
      toast.success(`${format === 'excel' ? 'Excel' : 'JSON'} отчёт скачан`)
    } catch { toast.error('Ошибка генерации') }
    setGenerating(null)
  }

  // Tariff breakdown max
  const tbMax = stats.tariffBreakdown?.length ? Math.max(...stats.tariffBreakdown.map(t => t.revenue)) : 1

  return (
    <>
      {/* ═══ 1. HEADER ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 px-5 pt-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Дашборд</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {([{ d: 1, l: 'Сегодня' }, { d: 7, l: '7д' }, { d: 30, l: '30д' }, { d: 90, l: '90д' }, { d: 365, l: 'Год' }] as const).map(({ d, l }) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                days === d ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-6 space-y-4">
        {/* ═══ 2. KPI CARDS ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          <Kpi icon={DollarSign} label="Выручка" value={fmtRub(kpi.revenue)} color="success" />
          <Kpi icon={TrendingDown} label="Расходы" value={fmtRub(kpi.expenses)} color="danger" />
          <Kpi icon={Wallet} label="Прибыль" value={fmtRub(kpi.profit)}
            color={kpi.profit >= 0 ? 'success' : 'danger'} trend={weekTrend} />
          <Kpi icon={Users} label="Пользователи" value={String(stats.users.total)} sub={`${stats.users.active} актив.`} color="primary" />
          <Kpi icon={CreditCard} label="Оплат" value={String(kpi.paidPayments || 0)}
            sub={fmtRub(kpi.revenue)} color="warning" />
          <Kpi icon={Percent} label="Конверсия" value={`${convRate}%`} sub={`${stats.users.active}/${stats.users.total}`} color="blue" />
        </div>

        {/* ═══ 3. TODAY HIGHLIGHT ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <TodayCard label="Выручка сегодня" value={fmtRub(stats.today.revenue)} icon={<DollarSign className="w-3.5 h-3.5 text-green-600" />} />
          <TodayCard label="Регистрации сегодня" value={String(stats.today.registrations)} icon={<Users className="w-3.5 h-3.5 text-indigo-600" />} />
          <TodayCard label="Из веб" value={String(stats.today.regWeb)} icon={<Activity className="w-3.5 h-3.5 text-blue-600" />} />
          <TodayCard label="Из бота" value={String(stats.today.regBot)} icon={<Zap className="w-3.5 h-3.5 text-purple-600" />} />
        </div>

        {/* ═══ 4. MAIN ROW: Revenue chart + REMNAWAVE ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" /> Выручка
              </h3>
              <span className="text-xs text-gray-400">{fmtRub(totalRev)}</span>
            </div>
            {dailyRev.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailyRev}>
                  <defs>
                    <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.success} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={C.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={fmtK} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [fmtRub(v), 'Выручка']} />
                  <Area type="monotone" dataKey="amount" stroke={C.success} fill="url(#rg)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <Empty />}
            {dailyRev.length > 0 && (
              <div className="grid grid-cols-3 gap-3 pt-3 mt-3 border-t border-gray-50 text-center">
                <StatCell label="Итого" value={fmtRub(Math.round(totalRev))} />
                <StatCell label="Ср./день" value={fmtRub(Math.round(avgDaily))} />
                <StatCell label="vs нед." value={`${weekTrend >= 0 ? '+' : ''}${weekTrend.toFixed(0)}%`}
                  color={weekTrend >= 0 ? 'text-green-600' : 'text-red-500'} />
              </div>
            )}
          </div>

          {/* REMNAWAVE panel */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">REMNAWAVE</h3>
              {rmw ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-400" />}
            </div>
            {rmw ? (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-medium text-emerald-700">Онлайн</span>
                </div>
                {rmw.cpu && <InfoRow icon={<Cpu className="w-3.5 h-3.5 text-gray-400" />} l="CPU" v={`${rmw.cpu.cores} ядер`} />}
                {rmw.memory && <>
                  <InfoRow icon={<HardDrive className="w-3.5 h-3.5 text-gray-400" />} l="RAM" v={`${fmtMb(rmw.memory.used)} / ${fmtMb(rmw.memory.total)} МБ`} />
                  <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${Math.round((rmw.memory.used / rmw.memory.total) * 100)}%` }} />
                  </div>
                </>}
                {rmw.uptime != null && <InfoRow icon={<Clock className="w-3.5 h-3.5 text-gray-400" />} l="Uptime" v={fmtUp(rmw.uptime)} />}

                {rmw.users && <div className="pt-2 mt-2 border-t border-gray-100">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1.5">VPN пользователи</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Mini l="Всего" v={rmw.users.totalUsers} />
                    <Mini l="Актив" v={rmw.users.statusCounts?.ACTIVE} c="text-emerald-600" />
                    <Mini l="Истекли" v={rmw.users.statusCounts?.EXPIRED} c="text-red-500" />
                    <Mini l="Откл." v={rmw.users.statusCounts?.DISABLED} c="text-amber-500" />
                  </div>
                </div>}

                {rmw.onlineStats && <div className="pt-2 mt-2 border-t border-gray-100">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1.5">Онлайн</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Mini l="Сейчас" v={rmw.onlineStats.onlineNow} c="text-primary-600" />
                    <Mini l="За день" v={rmw.onlineStats.lastDay} />
                    <Mini l="За неделю" v={rmw.onlineStats.lastWeek} />
                    <Mini l="Никогда" v={rmw.onlineStats.neverOnline} c="text-gray-400" />
                  </div>
                </div>}

                {rmw.nodes && <div className="pt-2 mt-2 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Mini l="Ноды" v={rmw.nodes.totalOnline} c="text-emerald-600" />
                    <Mini l="Трафик" v={fmtTb(rmw.nodes.totalBytesLifetime)} />
                  </div>
                </div>}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-xs text-red-600 font-medium">Недоступен</span>
              </div>
            )}
          </div>
        </div>

        {/* ═══ 5. COLLAPSIBLE CHARTS ═══ */}
        <button onClick={() => setChartsExpanded(!chartsExpanded)}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition w-full justify-center py-2 bg-white rounded-lg border border-gray-100">
          {chartsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {chartsExpanded ? 'Скрыть графики' : 'Больше графиков'}
        </button>

        {chartsExpanded && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Users bar chart */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
              <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-600" /> Регистрации
              </h3>
              {(charts.dailyUsers || []).length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={charts.dailyUsers}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" name="Регистрации" fill={C.primary} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>

            {/* Cumulative revenue */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
              <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" /> Накопительная выручка
              </h3>
              {dailyRev.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={dailyRev.reduce((acc: any[], d: any) => {
                    const prev = acc.length > 0 ? acc[acc.length - 1].cum : 0
                    acc.push({ date: d.date, cum: prev + Number(d.amount || 0) }); return acc
                  }, [])}>
                    <defs>
                      <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.purple} stopOpacity={0.12} />
                        <stop offset="95%" stopColor={C.purple} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={fmtK} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [fmtRub(v), 'Накоп.']} />
                    <Area type="monotone" dataKey="cum" stroke={C.purple} fill="url(#cg)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
          </div>
        )}

        {/* ═══ 6. BOTTOM WIDGETS ═══ */}
        {/* Row 1: Top tariffs + Categories */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Top tariffs */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Топ тарифы</h3>
            {topTariffs.length > 0 ? (
              <div className="space-y-2">
                {topTariffs.slice(0, 5).map((t, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
                      style={{ background: [C.primary, C.success, C.warning, C.danger, C.blue][i % 5] }}>
                      {i + 1}
                    </div>
                    <span className="flex-1 text-sm text-gray-800 truncate">{t.name}</span>
                    <span className="text-xs text-gray-400">{t.count}</span>
                    <span className="text-sm font-medium text-gray-900 tabular-nums">{fmtRub(t.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-4">Нет данных</p>}
          </div>

          {/* Categories */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Категории</h3>
            {categoryBreakdown.length > 0 ? (
              <div className="space-y-1.5">
                {categoryBreakdown.slice(0, 8).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.category?.color || '#9ca3af' }} />
                    <span className="flex-1 truncate text-gray-700">{c.category?.name || 'Другое'}</span>
                    <span className={`font-medium tabular-nums ${c.type === 'INCOME' ? 'text-green-600' : 'text-red-500'}`}>
                      {c.type === 'INCOME' ? '+' : '-'}{fmtRub(c.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-4">Нет данных</p>}
          </div>
        </div>

        {/* Row 2: VPN tariff breakdown + Milestones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* VPN subscriptions by tariff */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-3">VPN подписки по тарифам</h3>
            {stats.tariffBreakdown?.length ? (
              <div className="space-y-2.5">
                {stats.tariffBreakdown.map((t, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-700 truncate">{t.name}</span>
                      <span className="text-xs text-gray-500 tabular-nums ml-2 flex-shrink-0">{t.count} шт / {fmtRub(t.revenue)}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.round((t.revenue / tbMax) * 100)}%`,
                        background: [C.primary, C.success, C.warning, C.blue, C.purple, C.danger][i % 6],
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-4">Нет данных</p>}
          </div>

          {/* Milestones */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-500" /> Цели
            </h3>
            {stats.milestones?.length ? (
              <div className="space-y-3">
                {stats.milestones.map(m => {
                  const pct = m.targetAmount > 0 ? Math.min(Math.round((m.currentAmount / m.targetAmount) * 100), 100) : 0
                  return (
                    <div key={m.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 truncate">{m.name}</span>
                        <span className="text-[10px] text-gray-400 ml-2 flex-shrink-0">{pct}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {fmtRub(m.currentAmount)} / {fmtRub(m.targetAmount)}
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-4">Нет целей</p>}
          </div>
        </div>

        {/* ═══ 7. TABLES ROW ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent payments */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 overflow-hidden">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-green-600" /> Последние платежи
            </h3>
            {stats.recentPayments?.length ? (
              <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-50">
                      <th className="text-left py-2 pr-2 font-medium">Пользователь</th>
                      <th className="text-left py-2 pr-2 font-medium">Тариф</th>
                      <th className="text-right py-2 pr-2 font-medium">Сумма</th>
                      <th className="text-left py-2 pr-2 font-medium">Способ</th>
                      <th className="text-right py-2 font-medium">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentPayments.slice(0, 8).map(p => (
                      <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                        <td className="py-2 pr-2 text-gray-800 truncate max-w-[100px]">{p.userName || '---'}</td>
                        <td className="py-2 pr-2 text-gray-500 truncate max-w-[80px]">{p.tariffName || '---'}</td>
                        <td className="py-2 pr-2 text-right font-medium text-gray-900 tabular-nums whitespace-nowrap">
                          {(p.amount || 0).toLocaleString('ru')} {p.currency || '₽'}
                        </td>
                        <td className="py-2 pr-2 text-gray-500">{p.provider || '---'}</td>
                        <td className="py-2 text-right text-gray-400 whitespace-nowrap">{fmtShortDate(p.paidAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-4">Нет платежей</p>}
          </div>

          {/* Recent transactions */}
          <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 overflow-hidden">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-indigo-600" /> Последние операции
            </h3>
            {stats.recentTransactions?.length ? (
              <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-50">
                      <th className="text-left py-2 pr-2 font-medium">Тип</th>
                      <th className="text-left py-2 pr-2 font-medium">Описание</th>
                      <th className="text-left py-2 pr-2 font-medium">Категория</th>
                      <th className="text-right py-2 pr-2 font-medium">Сумма</th>
                      <th className="text-right py-2 font-medium">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentTransactions.slice(0, 8).map(t => (
                      <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                        <td className="py-2 pr-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            t.type === 'INCOME' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                          }`}>
                            {t.type === 'INCOME' ? 'Доход' : 'Расход'}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-gray-700 truncate max-w-[120px]">{t.description || '---'}</td>
                        <td className="py-2 pr-2">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.categoryColor || '#9ca3af' }} />
                            <span className="text-gray-500 truncate">{t.categoryName || '---'}</span>
                          </span>
                        </td>
                        <td className={`py-2 pr-2 text-right font-medium tabular-nums whitespace-nowrap ${
                          t.type === 'INCOME' ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {t.type === 'INCOME' ? '+' : '-'}{fmtRub(Math.abs(t.amount))}
                        </td>
                        <td className="py-2 text-right text-gray-400 whitespace-nowrap">{fmtShortDate(t.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-4">Нет операций</p>}
          </div>
        </div>

        {/* ═══ 8. CAMPAIGNS ═══ */}
        {stats.campaigns?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-purple-600" /> Рекламные кампании
            </h3>
            <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-50">
                    <th className="text-left py-2 pr-3 font-medium">Название</th>
                    <th className="text-left py-2 pr-3 font-medium">Формат</th>
                    <th className="text-right py-2 pr-3 font-medium">Бюджет</th>
                    <th className="text-right py-2 pr-3 font-medium">Подписчики</th>
                    <th className="text-right py-2 font-medium">CPS</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.campaigns.map(c => (
                    <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                      <td className="py-2 pr-3 text-gray-800 font-medium truncate max-w-[150px]">{c.name}</td>
                      <td className="py-2 pr-3 text-gray-500">{c.format || '---'}</td>
                      <td className="py-2 pr-3 text-right text-gray-900 tabular-nums whitespace-nowrap">{fmtRub(c.amount)}</td>
                      <td className="py-2 pr-3 text-right text-gray-700 tabular-nums">{c.subscribers}</td>
                      <td className="py-2 text-right tabular-nums whitespace-nowrap">
                        <span className={`font-medium ${c.cps > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {c.cps > 0 ? fmtRub(c.cps) : '---'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ 9. REPORT BUILDER ═══ */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <button onClick={() => setReportOpen(!reportOpen)}
            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-gray-50 transition">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center">
                <FileSpreadsheet className="w-4.5 h-4.5 text-primary-600" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-medium text-gray-900">Отчёты и экспорт</h3>
                <p className="text-xs text-gray-400">Excel, JSON --- выберите период и данные</p>
              </div>
            </div>
            {reportOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {reportOpen && (
            <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-gray-50">
              {/* Quick period */}
              <div className="pt-4">
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {[{ k: 'today', l: 'Сегодня' }, { k: 'month', l: 'Месяц' }, { k: 'year', l: 'Год' }].map(p => (
                    <button key={p.k} onClick={() => quickPeriod(p.k)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition">
                      {p.l}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 items-end flex-wrap">
                  <div>
                    <label className="text-[11px] text-gray-400 mb-0.5 block">С</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-800" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 mb-0.5 block">По</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-800" />
                  </div>
                </div>
              </div>

              {/* Data selection chips */}
              <div>
                <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Filter className="w-3 h-3" /> Данные для отчёта</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(reportSections).map(([key, val]) => (
                    <button key={key} onClick={() => setReportSections(p => ({ ...p, [key]: !p[key as keyof typeof p] }))}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                        val ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-gray-100 border-gray-200 text-gray-500'
                      }`}>
                      {{ transactions: 'Транзакции', payments: 'Платежи', users: 'Пользователи', categories: 'Категории', partners: 'Партнёры', servers: 'Серверы' }[key]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Download buttons */}
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => downloadReport('excel')} disabled={!!generating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50">
                  {generating === 'excel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Excel
                </button>
                <button onClick={() => downloadReport('json')} disabled={!!generating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition disabled:opacity-50">
                  {generating === 'json' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  JSON
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ═══ 10. QUICK ACTIONS ═══ */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
          <h3 className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-3">Быстрые действия</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowGrant(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-amber-50 border border-amber-100 text-amber-700 hover:bg-amber-100 transition">
              <Calendar className="w-3.5 h-3.5" /> Бонусные дни всем
            </button>
          </div>
        </div>
      </div>

      {/* ═══ GRANT MODAL ═══ */}
      {showGrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowGrant(false)} />
          <div className="relative bg-white rounded-xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Выдать бонусные дни</h3>
            <p className="text-sm text-gray-500">Бонусные дни начислятся всем активным пользователям.</p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Количество дней</label>
              <input type="number" className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200" value={grantDays} onChange={e => setGrantDays(+e.target.value)} min={1} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Описание</label>
              <input className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200" placeholder="Новогодний бонус" value={grantDesc} onChange={e => setGrantDesc(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowGrant(false)} className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Отмена</button>
              <button disabled={grantLoading || grantDays < 1}
                onClick={async () => {
                  setGrantLoading(true)
                  try {
                    const res = await adminApi.post('/grant-days-all', { days: grantDays, description: grantDesc })
                    toast.success(`+${grantDays} дней начислено ${res.updatedCount} пользователям`)
                    setShowGrant(false); setGrantDays(7); setGrantDesc('')
                  } catch (e: any) { toast.error(e.message || 'Ошибка') }
                  setGrantLoading(false)
                }}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50">
                {grantLoading ? 'Начисляю...' : `+${grantDays} дней`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════ */

const CM: Record<string, string> = { primary: '#6366f1', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', blue: '#3b82f6', purple: '#8b5cf6' }

function Kpi({ icon: Icon, label, value, sub, color, trend }: {
  icon: any; label: string; value: string; sub?: string; color: string; trend?: number
}) {
  const c = CM[color] || color
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4">
      <div className="flex items-center justify-between mb-1.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${c}12`, color: c }}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        {trend !== undefined && trend !== 0 && (
          <span className={`flex items-center gap-0.5 text-[10px] font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
            {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-base sm:text-lg font-bold text-gray-900 mt-0.5 truncate">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function TodayCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider truncate">{label}</p>
        <p className="text-sm font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

function InfoRow({ icon, l, v }: { icon: React.ReactNode; l: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-xs text-gray-500">{icon}{l}</span>
      <span className="text-xs font-mono font-medium text-gray-700">{v}</span>
    </div>
  )
}

function Mini({ l, v, c }: { l: string; v: any; c?: string }) {
  return (
    <div className="px-2 py-1.5 rounded-md bg-gray-50 border border-gray-100">
      <p className="text-[9px] uppercase tracking-wider text-gray-400">{l}</p>
      <p className={`text-sm font-bold ${c || 'text-gray-900'}`}>{v ?? '---'}</p>
    </div>
  )
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div><p className="text-[10px] text-gray-400">{label}</p><p className={`text-sm font-semibold ${color || 'text-gray-900'}`}>{value}</p></div>
}

function Empty() {
  return <div className="h-[180px] flex items-center justify-center text-gray-300 text-sm">Нет данных</div>
}
