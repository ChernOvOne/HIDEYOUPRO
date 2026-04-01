'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, TrendingUp, Users, DollarSign, CreditCard, Activity, Wifi, WifiOff } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import toast from 'react-hot-toast'

const api = (path: string) =>
  fetch(`/api/admin/analytics${path}`, { credentials: 'include' }).then(r => { if (!r.ok) throw new Error(); return r.json() })

const COLORS = ['#534AB7', '#1D9E75', '#BA7517', '#E24B4A', '#378ADD', '#D4537E', '#639922']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="text-gray-400 mb-1">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }}>{p.name}: <b>{typeof p.value === 'number' ? p.value.toLocaleString('ru') : p.value}</b></div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData]           = useState<any>(null)
  const [rmData, setRmData]       = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [days, setDays]           = useState(30)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, rm] = await Promise.all([
        api(`/overview?days=${days}`),
        api('/remnawave').catch(() => ({ health: { online: false }, nodes: [] })),
      ])
      setData(d)
      setRmData(rm)
    } catch { toast.error('Ошибка') }
    setLoading(false)
  }, [days])

  useEffect(() => { load() }, [load])

  if (loading || !data) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>

  const kpi = data.kpi

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
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${days === d ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
              {d === 7 ? '7д' : d === 30 ? '30д' : d === 90 ? '90д' : 'Год'}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content space-y-4">
        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
          <div className="kpi-card"><div className="kpi-label">Выручка</div><div className="kpi-value text-success-700">{kpi.revenue.toLocaleString('ru')} ₽</div></div>
          <div className="kpi-card"><div className="kpi-label">Расходы</div><div className="kpi-value text-danger-700">{kpi.expenses.toLocaleString('ru')} ₽</div></div>
          <div className="kpi-card"><div className="kpi-label">Прибыль</div><div className={`kpi-value ${kpi.profit >= 0 ? 'text-success-700' : 'text-danger-700'}`}>{kpi.profit.toLocaleString('ru')} ₽</div></div>
          <div className="kpi-card"><div className="kpi-label">Новых юзеров</div><div className="kpi-value">{kpi.newUsers}</div></div>
          <div className="kpi-card"><div className="kpi-label">Активных</div><div className="kpi-value text-primary-600">{kpi.activeUsers}</div></div>
          <div className="kpi-card"><div className="kpi-label">Оплат</div><div className="kpi-value">{kpi.paidPayments}</div></div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue chart */}
          <div className="card-p">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-success-700" /> Выручка по дням</h3>
            {data.charts.dailyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.charts.dailyRevenue}>
                  <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1D9E75" stopOpacity={0.15}/><stop offset="95%" stopColor="#1D9E75" stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="amount" name="Выручка" stroke="#1D9E75" fill="url(#revGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-[200px] flex items-center justify-center text-gray-300 text-sm">Нет данных</div>}
          </div>

          {/* Users chart */}
          <div className="card-p">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-primary-600" /> Регистрации</h3>
            {data.charts.dailyUsers.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.charts.dailyUsers}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Регистрации" fill="#534AB7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[200px] flex items-center justify-center text-gray-300 text-sm">Нет данных</div>}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top tariffs */}
          <div className="card-p">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4 text-warn-700" /> Топ тарифы</h3>
            {data.topTariffs.length > 0 ? (
              <div className="space-y-2">
                {data.topTariffs.map((t: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-bold" style={{ background: COLORS[i % COLORS.length] }}>{i + 1}</div>
                    <div className="flex-1 min-w-0"><div className="text-sm truncate">{t.name}</div><div className="text-xs text-gray-400">{t.count} продаж</div></div>
                    <div className="text-sm font-medium tabular-nums">{t.revenue.toLocaleString('ru')} ₽</div>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-gray-300 text-center py-4">Нет данных</div>}
          </div>

          {/* Category breakdown */}
          <div className="card-p">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary-600" /> По категориям</h3>
            {data.categoryBreakdown.length > 0 ? (
              <div className="space-y-2">
                {data.categoryBreakdown.slice(0, 8).map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.category.color || '#999' }} />
                    <span className="flex-1 truncate">{c.category.name}</span>
                    <span className={`font-medium tabular-nums ${c.type === 'INCOME' ? 'text-success-700' : 'text-danger-700'}`}>
                      {c.type === 'INCOME' ? '+' : '-'}{c.amount.toLocaleString('ru')} ₽
                    </span>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-gray-300 text-center py-4">Нет данных</div>}
          </div>

          {/* REMNAWAVE nodes */}
          <div className="card-p">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              {rmData?.health?.online ? <Wifi className="w-4 h-4 text-success-700" /> : <WifiOff className="w-4 h-4 text-danger-700" />}
              VPN серверы
            </h3>
            {rmData?.health?.online ? (
              <div className="space-y-2">
                {Array.isArray(rmData.nodes) && rmData.nodes.length > 0 ? rmData.nodes.map((n: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${n.isConnected ? 'bg-success-700' : 'bg-danger-700'}`} />
                    <span className="flex-1">{n.name || `Node ${i + 1}`}</span>
                    <span className="text-xs text-gray-400">{n.isConnected ? 'online' : 'offline'}</span>
                  </div>
                )) : <div className="text-sm text-gray-400">Нет узлов</div>}
              </div>
            ) : (
              <div className="text-sm text-gray-400 text-center py-4">REMNAWAVE не подключён</div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
