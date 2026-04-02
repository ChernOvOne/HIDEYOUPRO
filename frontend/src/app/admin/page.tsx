'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Users, CreditCard, DollarSign, Activity,
  Wallet, ArrowUpRight, ArrowDownRight, Loader2, Percent, Download,
  Cpu, HardDrive, Clock, Wifi, WifiOff, Calendar, FileSpreadsheet,
  ChevronDown, ChevronUp, Filter,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import toast from 'react-hot-toast'
import { api, adminApi } from '@/lib/api'

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface Stats {
  users:        { total: number; active: number }
  payments:     { total: number; paid: number; revenue: number }
  accounting:   { income: number; expenses: number; transactions: number }
  partners:     number
  revenueChart: Array<{ date: string; amount: number }>
}

interface AnalyticsData {
  kpi:     { revenue: number; expenses: number; profit: number; newUsers: number; activeUsers: number; paidPayments: number }
  charts:  { dailyRevenue: any[]; dailyUsers: any[]; dailyPayments?: any[] }
  topTariffs:        Array<{ name: string; count: number; revenue: number }>
  categoryBreakdown: Array<{ category: { name: string; color: string }; type: string; amount: number }>
}

interface RemnawaveData {
  health?: { online: boolean }
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

const fmtDate = (d: string) => { try { const dt = new Date(d); return `${dt.getDate()}.${String(dt.getMonth()+1).padStart(2,'0')}` } catch { return d } }
const fmtK = (v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)
const fmtMb = (b: number) => Math.round(b/1024/1024).toLocaleString('ru')
const fmtUp = (s: number) => { const d=Math.floor(s/86400), h=Math.floor((s%86400)/3600); return d > 0 ? `${d}д ${h}ч` : `${h}ч ${Math.floor((s%3600)/60)}м` }
const fmtTb = (b: any) => { const n = typeof b === 'string' ? parseFloat(b) : b; if (!n) return '—'; const tb = n/(1024**4); return tb >= 1 ? `${tb.toFixed(1)} ТБ` : `${(n/(1024**3)).toFixed(0)} ГБ` }

/* ═══════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const [stats, setStats]     = useState<Stats | null>(null)
  const [anData, setAnData]   = useState<AnalyticsData | null>(null)
  const [rmw, setRmw]         = useState<RemnawaveData | null>(null)
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
      const [s, an, rm] = await Promise.all([
        api.stats(),
        fetch(`/api/admin/analytics/overview?days=${days}`, { credentials: 'include' }).then(r => r.json()).catch(() => null),
        adminApi.get<RemnawaveData>('/analytics/remnawave').catch(() => null),
      ])
      setStats(s)
      setAnData(an)
      setRmw(rm)
    } catch {}
    setLoading(false)
  }, [days])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>
  if (!stats) return null

  const kpi = anData?.kpi || { revenue: stats.accounting.income, expenses: stats.accounting.expenses, profit: stats.accounting.income - stats.accounting.expenses, newUsers: 0, activeUsers: stats.users.active, paidPayments: stats.payments.paid }
  const charts = anData?.charts || { dailyRevenue: stats.revenueChart || [], dailyUsers: [], dailyPayments: [] }
  const topTariffs = anData?.topTariffs || []
  const categoryBreakdown = anData?.categoryBreakdown || []

  // Trends
  const dailyRev = charts.dailyRevenue || []
  const totalRev = dailyRev.reduce((s: number, d: any) => s + Number(d.amount || 0), 0)
  const avgDaily = dailyRev.length > 0 ? totalRev / dailyRev.length : 0
  const weeks = dailyRev.reduce((acc: number[], _: any, i: number) => { const w = Math.floor(i/7); acc[w] = (acc[w]||0) + Number(dailyRev[i]?.amount||0); return acc }, [])
  const weekChange = weeks.length >= 2 ? ((weeks[weeks.length-1] - weeks[weeks.length-2]) / Math.max(weeks[weeks.length-2], 1)) * 100 : 0

  const convRate = stats.users.total > 0 ? Math.round((stats.users.active / stats.users.total) * 100) : 0

  // Report builder
  const quickPeriod = (type: string) => {
    const n = new Date()
    if (type === 'today') { setDateFrom(n.toISOString().split('T')[0]); setDateTo(n.toISOString().split('T')[0]) }
    if (type === 'month') { setDateFrom(new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split('T')[0]); setDateTo(n.toISOString().split('T')[0]) }
    if (type === 'year')  { setDateFrom(new Date(n.getFullYear(), 0, 1).toISOString().split('T')[0]); setDateTo(n.toISOString().split('T')[0]) }
  }

  const downloadExcel = async () => {
    setGenerating('excel')
    try {
      const res = await fetch('/api/admin/reports/excel', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateFrom, dateTo }),
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `report_${dateFrom}_${dateTo}.xlsx`; a.click()
      URL.revokeObjectURL(url)
      toast.success('Excel отчёт скачан')
    } catch { toast.error('Ошибка генерации') }
    setGenerating(null)
  }

  const downloadJSON = async () => {
    setGenerating('json')
    try {
      const res = await fetch('/api/admin/reports/data', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateFrom, dateTo }),
      })
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `report_${dateFrom}_${dateTo}.json`; a.click()
      URL.revokeObjectURL(url)
      toast.success('JSON отчёт скачан')
    } catch { toast.error('Ошибка генерации') }
    setGenerating(null)
  }

  return (
    <>
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 px-5 pt-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Дашборд</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {[7, 30, 90, 365].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                days === d ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              {d === 7 ? '7д' : d === 30 ? '30д' : d === 90 ? '90д' : 'Год'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-6 space-y-4">
        {/* ═══ KPI CARDS ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          <Kpi icon={DollarSign} label="Выручка" value={`${(kpi.revenue||0).toLocaleString('ru')} ₽`} color="success" />
          <Kpi icon={TrendingDown} label="Расходы" value={`${(kpi.expenses||0).toLocaleString('ru')} ₽`} color="danger" />
          <Kpi icon={Wallet} label="Прибыль" value={`${(kpi.profit||0).toLocaleString('ru')} ₽`}
            color={kpi.profit >= 0 ? 'success' : 'danger'} trend={weekChange} />
          <Kpi icon={Users} label="Пользователи" value={String(stats.users.total)} sub={`${stats.users.active} актив.`} color="primary" />
          <Kpi icon={CreditCard} label="Оплат" value={String(kpi.paidPayments||0)}
            sub={`${(kpi.revenue||0).toLocaleString('ru')} ₽`} color="warning" />
          <Kpi icon={Percent} label="Конверсия" value={`${convRate}%`} sub={`${stats.users.active}/${stats.users.total}`} color="blue" />
        </div>

        {/* ═══ MAIN CHART + REMNAWAVE ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" /> Выручка
              </h3>
              <span className="text-xs text-gray-400">{totalRev.toLocaleString('ru')} ₽</span>
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
                    formatter={(v: number) => [`${v.toLocaleString('ru')} ₽`, 'Выручка']} />
                  <Area type="monotone" dataKey="amount" stroke={C.success} fill="url(#rg)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <Empty />}
            {dailyRev.length > 0 && (
              <div className="grid grid-cols-3 gap-3 pt-3 mt-3 border-t border-gray-50 text-center">
                <Stat label="Итого" value={`${Math.round(totalRev).toLocaleString('ru')} ₽`} />
                <Stat label="Ср./день" value={`${Math.round(avgDaily).toLocaleString('ru')} ₽`} />
                <Stat label="vs нед." value={`${weekChange >= 0 ? '+' : ''}${weekChange.toFixed(0)}%`}
                  color={weekChange >= 0 ? 'text-green-600' : 'text-red-500'} />
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
                {rmw.cpu && <Row icon={<Cpu className="w-3.5 h-3.5 text-gray-400" />} l="CPU" v={`${rmw.cpu.cores} ядер`} />}
                {rmw.memory && <>
                  <Row icon={<HardDrive className="w-3.5 h-3.5 text-gray-400" />} l="RAM" v={`${fmtMb(rmw.memory.used)} / ${fmtMb(rmw.memory.total)} МБ`} />
                  <div className="w-full h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-primary-600" style={{ width: `${Math.round((rmw.memory.used / rmw.memory.total) * 100)}%` }} />
                  </div>
                </>}
                {rmw.uptime != null && <Row icon={<Clock className="w-3.5 h-3.5 text-gray-400" />} l="Uptime" v={fmtUp(rmw.uptime)} />}

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

        {/* ═══ EXTRA CHARTS (collapsible) ═══ */}
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
              {(charts.dailyUsers||[]).length > 0 ? (
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
                    const prev = acc.length > 0 ? acc[acc.length-1].cum : 0
                    acc.push({ date: d.date, cum: prev + Number(d.amount||0) }); return acc
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
                      formatter={(v: number) => [`${v.toLocaleString('ru')} ₽`, 'Накоп.']} />
                    <Area type="monotone" dataKey="cum" stroke={C.purple} fill="url(#cg)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
          </div>
        )}

        {/* ═══ BOTTOM ROW: Tariffs + Categories ═══ */}
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
                      {i+1}
                    </div>
                    <span className="flex-1 text-sm text-gray-800 truncate">{t.name}</span>
                    <span className="text-xs text-gray-400">{t.count}</span>
                    <span className="text-sm font-medium text-gray-900 tabular-nums">{(t.revenue||0).toLocaleString('ru')} ₽</span>
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
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.category?.color || '#9ca3af' }} />
                    <span className="flex-1 truncate text-gray-700">{c.category?.name || 'Другое'}</span>
                    <span className={`font-medium tabular-nums ${c.type === 'INCOME' ? 'text-green-600' : 'text-red-500'}`}>
                      {c.type === 'INCOME' ? '+' : '-'}{(c.amount||0).toLocaleString('ru')} ₽
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-4">Нет данных</p>}
          </div>
        </div>

        {/* ═══ REPORT BUILDER ═══ */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <button onClick={() => setReportOpen(!reportOpen)}
            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-gray-50 transition">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center">
                <FileSpreadsheet className="w-4.5 h-4.5 text-primary-600" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-medium text-gray-900">Отчёты и экспорт</h3>
                <p className="text-xs text-gray-400">Excel, JSON — выберите период и данные</p>
              </div>
            </div>
            {reportOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {reportOpen && (
            <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-gray-50">
              {/* Period */}
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

              {/* Data selection */}
              <div>
                <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Filter className="w-3 h-3" /> Данные для отчёта</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(reportSections).map(([key, val]) => (
                    <button key={key} onClick={() => setReportSections(p => ({ ...p, [key]: !p[key as keyof typeof p] }))}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                        val ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-gray-200 text-gray-400'
                      }`}>
                      {{ transactions: 'Транзакции', payments: 'Платежи', users: 'Пользователи', categories: 'Категории', partners: 'Партнёры', servers: 'Серверы' }[key]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Download buttons */}
              <div className="flex gap-3 flex-wrap">
                <button onClick={downloadExcel} disabled={!!generating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50">
                  {generating === 'excel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Excel
                </button>
                <button onClick={downloadJSON} disabled={!!generating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition disabled:opacity-50">
                  {generating === 'json' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  JSON
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ═══ QUICK ACTIONS ═══ */}
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

function Row({ icon, l, v }: { icon: React.ReactNode; l: string; v: string }) {
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
      <p className={`text-sm font-bold ${c || 'text-gray-900'}`}>{v ?? '—'}</p>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div><p className="text-[10px] text-gray-400">{label}</p><p className={`text-sm font-semibold ${color || 'text-gray-900'}`}>{value}</p></div>
}

function Empty() {
  return <div className="h-[180px] flex items-center justify-center text-gray-300 text-sm">Нет данных</div>
}
