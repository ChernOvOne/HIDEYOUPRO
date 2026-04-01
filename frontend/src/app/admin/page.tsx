'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Users, CreditCard, DollarSign, Activity,
  Server, Wallet, ArrowUpRight, ArrowDownRight, Loader2,
} from 'lucide-react'
import { api } from '@/lib/api'

interface Stats {
  users:      { total: number; active: number }
  payments:   { total: number; paid: number; revenue: number }
  accounting: { income: number; expenses: number; transactions: number }
  partners:   number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | 'month' | 'year'>('month')

  const load = useCallback(async () => {
    try {
      const s = await api.stats()
      setStats(s)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
    </div>
  )

  const profit = (stats?.accounting.income || 0) - (stats?.accounting.expenses || 0)

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Дашборд</h1>
          <p className="page-subtitle">Обзор платформы</p>
        </div>
        <div className="flex gap-1">
          {(['today', 'month', 'year'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                period === p ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {p === 'today' ? 'Сегодня' : p === 'month' ? 'Месяц' : 'Год'}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content space-y-4">
        {/* ═══ KPI Cards ═══ */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="kpi-card">
            <div className="flex items-center justify-between">
              <span className="kpi-label">Выручка</span>
              <DollarSign className="w-4 h-4 text-success-700" />
            </div>
            <div className="kpi-value text-success-700">
              {Number(stats?.accounting.income || 0).toLocaleString('ru')} <span className="text-sm">₽</span>
            </div>
            <div className="kpi-sub flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-success-700" /> Доход
            </div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center justify-between">
              <span className="kpi-label">Расходы</span>
              <TrendingDown className="w-4 h-4 text-danger-700" />
            </div>
            <div className="kpi-value text-danger-700">
              {Number(stats?.accounting.expenses || 0).toLocaleString('ru')} <span className="text-sm">₽</span>
            </div>
            <div className="kpi-sub flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3 text-danger-700" /> Расход
            </div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center justify-between">
              <span className="kpi-label">Прибыль</span>
              <Wallet className="w-4 h-4 text-primary-600" />
            </div>
            <div className={`kpi-value ${profit >= 0 ? 'text-success-700' : 'text-danger-700'}`}>
              {profit.toLocaleString('ru')} <span className="text-sm">₽</span>
            </div>
            <div className="kpi-sub">Доход - расход</div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center justify-between">
              <span className="kpi-label">Пользователи</span>
              <Users className="w-4 h-4 text-primary-600" />
            </div>
            <div className="kpi-value">{stats?.users.total || 0}</div>
            <div className="kpi-sub">
              <span className="badge-success">{stats?.users.active || 0} активных</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center justify-between">
              <span className="kpi-label">Оплат</span>
              <CreditCard className="w-4 h-4 text-warn-700" />
            </div>
            <div className="kpi-value">{stats?.payments.paid || 0}</div>
            <div className="kpi-sub">
              {Number(stats?.payments.revenue || 0).toLocaleString('ru')} ₽
            </div>
          </div>
        </div>

        {/* ═══ Grid: Charts + REMNAWAVE ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Revenue chart placeholder */}
          <div className="card-p">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Выручка</h3>
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </div>
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
              График будет доступен после накопления данных
            </div>
          </div>

          {/* REMNAWAVE Status */}
          <div className="card-p">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">VPN (REMNAWAVE)</h3>
              <Activity className="w-4 h-4 text-gray-400" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Активных подписок</span>
                <span className="text-sm font-medium">{stats?.users.active || 0}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Всего пользователей</span>
                <span className="text-sm font-medium">{stats?.users.total || 0}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Оплат за период</span>
                <span className="text-sm font-medium">{stats?.payments.paid || 0}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500">Партнёров</span>
                <span className="text-sm font-medium">{stats?.partners || 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Heatmap placeholder ═══ */}
        <div className="card-p">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">Карта активности</h3>
            <span className="text-xs text-gray-400">{stats?.accounting.transactions || 0} транзакций</span>
          </div>
          <div className="h-32 flex items-center justify-center text-gray-300 text-sm">
            Heatmap — после накопления данных
          </div>
        </div>
      </div>
    </>
  )
}
