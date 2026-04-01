'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, TrendingUp, Users, DollarSign, CreditCard, Activity,
  Wifi, WifiOff, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import toast from 'react-hot-toast'

/* ── API ───────────────────────────────────────── */

const api = (path: string) =>
  fetch(`/api/admin/analytics${path}`, { credentials: 'include' })
    .then(r => { if (!r.ok) throw new Error(); return r.json() })

/* ── Chart colors ──────────────────────────────── */

const COLORS = {
  primary:  '#6366f1',
  success:  '#10b981',
  warning:  '#f59e0b',
  danger:   '#ef4444',
  blue:     '#3b82f6',
  purple:   '#8b5cf6',
}

/* ── Custom tooltip ────────────────────────────── */

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="text-gray-400 mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: <b>{typeof p.value === 'number' ? p.value.toLocaleString('ru') : p.value}</b>
        </div>
      ))}
    </div>
  )
}

/* ── Component ─────────────────────────────────── */

export default function AnalyticsPage() {
  const [data, setData]       = useState<any>(null)
  const [rmData, setRmData]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays]       = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, rm] = await Promise.all([
        api(`/overview?days=${days}`),
        api('/remnawave').catch(() => ({ health: { online: false }, nodes: [] })),
      ])
      setData(d)
      setRmData(rm)
    } catch { toast.error('Ошибка загрузки') }
    setLoading(false)
  }, [days])

  useEffect(() => { load() }, [load])

  if (loading || !data) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
    </div>
  )

  const kpi = data.kpi || {}
  const charts = data.charts || {}
  const topTariffs = data.topTariffs || []
  const categoryBreakdown = data.categoryBreakdown || []

  // Compute trends
  const dailyRevenue = charts.dailyRevenue || []
  const dailyUsers = charts.dailyUsers || []
  const dailyPayments = charts.dailyPayments || []

  const totalRev = dailyRevenue.reduce((s: number, d: any) => s + Number(d.amount || 0), 0)
  const avgDaily = dailyRevenue.length > 0 ? totalRev / dailyRevenue.length : 0

  // Week-over-week
  const weeks = dailyRevenue.reduce((acc: number[], _: any, i: number) => {
    const wk = Math.floor(i / 7)
    acc[wk] = (acc[wk] || 0) + Number(dailyRevenue[i]?.amount || 0)
    return acc
  }, [])
  const weekChange = weeks.length >= 2
    ? ((weeks[weeks.length - 1] - weeks[weeks.length - 2]) / Math.max(weeks[weeks.length - 2], 1)) * 100
    : 0

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Аналитика</h1>
          <p className="page-subtitle">Данные за {days} дней</p>
        </div>
        <div className="flex gap-1">
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

      <div className="page-content space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
          <KpiCard label="Выручка" value={`${(kpi.revenue || 0).toLocaleString('ru')} ₽`} icon={DollarSign} color="success" />
          <KpiCard label="Расходы" value={`${(kpi.expenses || 0).toLocaleString('ru')} ₽`} icon={TrendingUp} color="danger" />
          <KpiCard label="Прибыль" value={`${(kpi.profit || 0).toLocaleString('ru')} ₽`} icon={TrendingUp}
            color={kpi.profit >= 0 ? 'success' : 'danger'} trend={weekChange} />
          <KpiCard label="Новых" value={String(kpi.newUsers || 0)} icon={Users} color="primary" />
          <KpiCard label="Активных" value={String(kpi.activeUsers || 0)} icon={Activity} color="blue" />
          <KpiCard label="Оплат" value={String(kpi.paidPayments || 0)} icon={CreditCard} color="warning" />
        </div>

        {/* Charts row 1: Revenue + Users */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue area chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" /> Выручка по дням
            </h3>
            {dailyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyRevenue}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="amount" name="Выручка ₽" stroke={COLORS.success} fill="url(#revGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
            {dailyRevenue.length > 0 && (
              <div className="grid grid-cols-3 gap-4 pt-3 mt-3 border-t border-gray-100 text-center">
                <ChartStat label="Итого" value={`${Math.round(totalRev).toLocaleString('ru')} ₽`} />
                <ChartStat label="Среднее/день" value={`${Math.round(avgDaily).toLocaleString('ru')} ₽`} />
                <ChartStat label="vs прошл. нед." value={`${weekChange >= 0 ? '+' : ''}${weekChange.toFixed(1)}%`}
                  color={weekChange >= 0 ? 'text-green-600' : 'text-red-600'} />
              </div>
            )}
          </div>

          {/* Users bar chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-600" /> Регистрации
            </h3>
            {dailyUsers.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyUsers}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Регистрации" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>

        {/* Charts row 2: Payments line + Revenue line */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Payments line chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-600" /> Оплаты по дням
            </h3>
            {dailyPayments.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyPayments}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="count" name="Оплаты" stroke={COLORS.warning} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>

          {/* Cumulative revenue */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" /> Накопительная выручка
            </h3>
            {dailyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailyRevenue.reduce((acc: any[], d: any) => {
                  const prev = acc.length > 0 ? acc[acc.length - 1].cumulative : 0
                  acc.push({ date: d.date, cumulative: prev + Number(d.amount || 0) })
                  return acc
                }, [])}>
                  <defs>
                    <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="cumulative" name="Накоп. ₽" stroke={COLORS.purple} fill="url(#cumGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>

        {/* Bottom row: Top tariffs + Categories + VPN */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top tariffs */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-600" /> Топ тарифы
            </h3>
            {topTariffs.length > 0 ? (
              <div className="space-y-2.5">
                {topTariffs.slice(0, 6).map((t: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold"
                      style={{ background: [COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger, COLORS.blue, COLORS.purple][i % 6] }}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 truncate">{t.name}</div>
                      <div className="text-xs text-gray-400">{t.count} продаж</div>
                    </div>
                    <div className="text-sm font-medium text-gray-900 tabular-nums">
                      {(t.revenue || 0).toLocaleString('ru')} ₽
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-4">Нет данных</p>}
          </div>

          {/* Category breakdown */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-600" /> По категориям
            </h3>
            {categoryBreakdown.length > 0 ? (
              <div className="space-y-2">
                {categoryBreakdown.slice(0, 8).map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.category?.color || '#9ca3af' }} />
                    <span className="flex-1 truncate text-gray-700">{c.category?.name || 'Другое'}</span>
                    <span className={`font-medium tabular-nums ${c.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                      {c.type === 'INCOME' ? '+' : '-'}{(c.amount || 0).toLocaleString('ru')} ₽
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-4">Нет данных</p>}
          </div>

          {/* VPN nodes */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              {rmData?.health?.online
                ? <Wifi className="w-4 h-4 text-green-600" />
                : <WifiOff className="w-4 h-4 text-red-600" />
              }
              VPN серверы
            </h3>
            {rmData?.health?.online ? (
              <div className="space-y-2">
                {Array.isArray(rmData.nodes) && rmData.nodes.length > 0 ? rmData.nodes.map((n: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${n.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="flex-1 text-gray-700">{n.name || `Node ${i + 1}`}</span>
                    <span className="text-xs text-gray-400">{n.isConnected ? 'online' : 'offline'}</span>
                  </div>
                )) : <p className="text-sm text-gray-400">Нет узлов</p>}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-red-700 font-medium">Panel недоступен</p>
                  <p className="text-xs text-red-400 mt-0.5">Проверьте REMNAWAVE_URL и REMNAWAVE_TOKEN</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* ── Shared components ─────────────────────────── */

const COLOR_MAP: Record<string, string> = {
  primary: '#6366f1', success: '#10b981', warning: '#f59e0b',
  danger: '#ef4444', blue: '#3b82f6', purple: '#8b5cf6',
}

function KpiCard({ label, value, icon: Icon, color, trend }: {
  label: string; value: string; icon: any; color: string; trend?: number
}) {
  const c = COLOR_MAP[color] || color
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c}12`, color: c }}>
          <Icon className="w-4 h-4" />
        </div>
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend).toFixed(0)}%
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="h-[200px] flex items-center justify-center text-gray-300 text-sm">
      Нет данных за период
    </div>
  )
}

function ChartStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`font-semibold text-gray-900 mt-0.5 ${color || ''}`}>{value}</p>
    </div>
  )
}
