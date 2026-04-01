'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Users, CreditCard, DollarSign, Activity,
  Wallet, ArrowUpRight, ArrowDownRight, Loader2, Calendar, Percent,
  Cpu, HardDrive, Clock, Server, Wifi,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { api, adminApi } from '@/lib/api'

/* ─── Types ─── */

interface Stats {
  users:        { total: number; active: number }
  payments:     { total: number; paid: number; revenue: number }
  accounting:   { income: number; expenses: number; transactions: number }
  partners:     number
  revenueChart: Array<{ date: string; amount: number }>
}

interface RemnawaveData {
  cpu?:         { cores: number; usage?: number }
  memory?:      { used: number; total: number }
  uptime?:      number
  users?:       { totalUsers: number; statusCounts?: Record<string, number> }
  onlineStats?: { onlineNow: number; lastDay: number; lastWeek: number; neverOnline: number }
  nodes?:       { totalOnline: number; totalBytesLifetime: string | number }
}

/* ─── Page ─── */

export default function DashboardPage() {
  const [stats, setStats]       = useState<Stats | null>(null)
  const [rmw, setRmw]           = useState<RemnawaveData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [period, setPeriod]     = useState<'today' | 'month' | 'year'>('month')

  // Grant bonus days modal
  const [showGrant, setShowGrant]       = useState(false)
  const [grantDays, setGrantDays]       = useState(7)
  const [grantDesc, setGrantDesc]       = useState('')
  const [grantLoading, setGrantLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        api.stats(),
        adminApi.get<RemnawaveData>('/analytics/remnawave').catch(() => null),
      ])
      setStats(s)
      setRmw(r)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
    </div>
  )

  if (!stats) return null

  const profit   = (stats.accounting.income || 0) - (stats.accounting.expenses || 0)
  const convRate = stats.users.total > 0
    ? Math.round((stats.users.active / stats.users.total) * 100)
    : 0

  /* Chart data — format dates for display */
  const chartData = (stats.revenueChart || []).map(d => ({
    date:   formatChartDate(d.date),
    amount: Number(d.amount),
  }))

  return (
    <>
      {/* ═══ Header + period selector ═══ */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Дашборд</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex gap-1">
          {(['today', 'month', 'year'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                period === p
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {p === 'today' ? 'Сегодня' : p === 'month' ? 'Месяц' : 'Год'}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ KPI Cards — 6 cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <KpiCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Выручка"
          value={`${Number(stats.accounting.income || 0).toLocaleString('ru')} ₽`}
          sub={<span className="flex items-center gap-0.5 text-emerald-600"><ArrowUpRight className="w-3 h-3" /> Доход</span>}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <KpiCard
          icon={<TrendingDown className="w-4 h-4" />}
          label="Расходы"
          value={`${Number(stats.accounting.expenses || 0).toLocaleString('ru')} ₽`}
          sub={<span className="flex items-center gap-0.5 text-red-500"><ArrowDownRight className="w-3 h-3" /> Расход</span>}
          iconColor="text-red-500"
          iconBg="bg-red-50"
        />
        <KpiCard
          icon={<Wallet className="w-4 h-4" />}
          label="Прибыль"
          value={`${profit.toLocaleString('ru')} ₽`}
          valueColor={profit >= 0 ? 'text-emerald-600' : 'text-red-500'}
          sub="Доход - расход"
          iconColor="text-primary-600"
          iconBg="bg-primary-50"
        />
        <KpiCard
          icon={<Users className="w-4 h-4" />}
          label="Пользователи"
          value={String(stats.users.total || 0)}
          sub={<span className="text-emerald-600">{stats.users.active || 0} активных</span>}
          iconColor="text-primary-600"
          iconBg="bg-primary-50"
        />
        <KpiCard
          icon={<CreditCard className="w-4 h-4" />}
          label="Оплат"
          value={String(stats.payments.paid || 0)}
          sub={`${Number(stats.payments.revenue || 0).toLocaleString('ru')} ₽`}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <KpiCard
          icon={<Percent className="w-4 h-4" />}
          label="Конверсия"
          value={`${convRate}%`}
          sub={`${stats.users.active} из ${stats.users.total}`}
          iconColor="text-primary-600"
          iconBg="bg-primary-50"
        />
      </div>

      {/* ═══ Chart + REMNAWAVE ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">Выручка за 30 дней</h3>
            <span className="text-xs text-gray-400">
              {Number(stats.accounting.income || 0).toLocaleString('ru')} ₽ всего
            </span>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                  formatter={(val: number) => [`${val.toLocaleString('ru')} ₽`, 'Выручка']}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  fill="url(#revenueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-300 text-sm">
              Нет данных за этот период
            </div>
          )}
        </div>

        {/* REMNAWAVE status */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-900">REMNAWAVE</h3>
            <Activity className="w-4 h-4 text-gray-400" />
          </div>

          {rmw ? (
            <div className="space-y-3">
              {/* Online badge */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-700">Онлайн</span>
              </div>

              {/* Server resources */}
              <div className="space-y-2">
                {rmw.cpu && (
                  <RmRow icon={<Cpu className="w-3.5 h-3.5 text-gray-400" />} label="CPU" value={`${rmw.cpu.cores} ядер`} />
                )}
                {rmw.memory && (
                  <>
                    <RmRow icon={<HardDrive className="w-3.5 h-3.5 text-gray-400" />} label="RAM"
                           value={`${formatMb(rmw.memory.used)} / ${formatMb(rmw.memory.total)} МБ`} />
                    <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-primary-600 transition-all"
                           style={{ width: `${Math.round((rmw.memory.used / rmw.memory.total) * 100)}%` }} />
                    </div>
                  </>
                )}
                {rmw.uptime != null && (
                  <RmRow icon={<Clock className="w-3.5 h-3.5 text-gray-400" />} label="Uptime" value={formatUptime(rmw.uptime)} />
                )}
              </div>

              {/* Users */}
              {rmw.users && (
                <div className="pt-3 mt-3 border-t border-gray-100">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-2">Пользователи VPN</p>
                  <div className="grid grid-cols-2 gap-2">
                    <RmStatBox label="Всего" value={rmw.users.totalUsers} />
                    <RmStatBox label="Активных" value={rmw.users.statusCounts?.ACTIVE} color="text-emerald-600" />
                    <RmStatBox label="Истёкших" value={rmw.users.statusCounts?.EXPIRED} color="text-red-500" />
                    <RmStatBox label="Откл." value={rmw.users.statusCounts?.DISABLED} color="text-amber-500" />
                  </div>
                </div>
              )}

              {/* Online stats */}
              {rmw.onlineStats && (
                <div className="pt-3 mt-3 border-t border-gray-100">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-2">Онлайн</p>
                  <div className="grid grid-cols-2 gap-2">
                    <RmStatBox label="Сейчас" value={rmw.onlineStats.onlineNow} color="text-primary-600" />
                    <RmStatBox label="За день" value={rmw.onlineStats.lastDay} />
                    <RmStatBox label="За неделю" value={rmw.onlineStats.lastWeek} />
                    <RmStatBox label="Никогда" value={rmw.onlineStats.neverOnline} color="text-gray-400" />
                  </div>
                </div>
              )}

              {/* Nodes */}
              {rmw.nodes && (
                <div className="pt-3 mt-3 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-2">
                    <RmStatBox label="Ноды онлайн" value={rmw.nodes.totalOnline} color="text-emerald-600" />
                    <RmStatBox label="Трафик" value={formatTb(rmw.nodes.totalBytesLifetime)} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-xs font-medium text-red-600">Недоступен</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Quick actions with bonus days button ═══ */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900">Быстрые действия</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowGrant(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-amber-50 border border-amber-100 text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Выдать бонусные дни всем
          </button>
        </div>
      </div>

      {/* ═══ Grant bonus days modal ═══ */}
      {showGrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowGrant(false)} />
          <div className="relative bg-white rounded-xl border border-gray-100 w-full max-w-md p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Выдать бонусные дни</h3>
            <p className="text-sm text-gray-500">
              Бонусные дни будут начислены всем активным пользователям.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Количество дней</label>
              <input
                type="number"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                placeholder="7"
                value={grantDays}
                onChange={e => setGrantDays(+e.target.value)}
                min={1}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Описание (необязательно)</label>
              <input
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                placeholder="Например: Новогодний бонус"
                value={grantDesc}
                onChange={e => setGrantDesc(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowGrant(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                disabled={grantLoading || grantDays < 1}
                onClick={async () => {
                  setGrantLoading(true)
                  try {
                    const res = await adminApi.post('/grant-days-all', { days: grantDays, description: grantDesc })
                    alert(`+${grantDays} дней начислено ${res.updatedCount} пользователям`)
                    setShowGrant(false)
                    setGrantDays(7)
                    setGrantDesc('')
                  } catch (e: any) {
                    alert(e.message || 'Ошибка')
                  } finally {
                    setGrantLoading(false)
                  }
                }}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {grantLoading ? 'Начисляю...' : `+${grantDays} дней всем`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Sub-components ─── */

function KpiCard({ icon, label, value, valueColor, sub, iconColor, iconBg }: {
  icon: React.ReactNode
  label: string
  value: string
  valueColor?: string
  sub?: React.ReactNode
  iconColor: string
  iconBg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg} ${iconColor}`}>
          {icon}
        </div>
      </div>
      <p className={`text-xl font-bold ${valueColor || 'text-gray-900'}`}>{value}</p>
      {sub && (
        <p className="text-xs text-gray-400 mt-1">{sub}</p>
      )}
    </div>
  )
}

function RmRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-xs text-gray-500">
        {icon}{label}
      </span>
      <span className="text-xs font-mono font-medium text-gray-700">{value}</span>
    </div>
  )
}

function RmStatBox({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
      <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color || 'text-gray-900'}`}>
        {value ?? '\u2014'}
      </p>
    </div>
  )
}

/* ─── Helpers ─── */

function formatChartDate(d: string): string {
  try {
    const date = new Date(d)
    return `${date.getDate()}.${String(date.getMonth() + 1).padStart(2, '0')}`
  } catch {
    return d
  }
}

function formatMb(bytes: number): string {
  return Math.round(bytes / 1024 / 1024).toLocaleString('ru')
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}д ${h}ч`
  if (h > 0) return `${h}ч ${m}м`
  return `${m}м`
}

function formatTb(bytes: string | number): string {
  const num = typeof bytes === 'string' ? parseFloat(bytes) : bytes
  if (!num || isNaN(num)) return '\u2014'
  const tb = num / (1024 * 1024 * 1024 * 1024)
  if (tb >= 1) return `${tb.toFixed(1)} ТБ`
  const gb = num / (1024 * 1024 * 1024)
  return `${gb.toFixed(0)} ГБ`
}
