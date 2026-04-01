'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Search, ChevronLeft, ChevronRight, Loader2, DollarSign, Clock,
  TrendingUp, CreditCard, Calendar, Key, Plus, Trash2, Copy,
  X, ExternalLink, AlertCircle, Tag, Eye, EyeOff,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ── Types ─────────────────────────────────────── */

interface PaymentUser {
  id?: string
  email?: string
  telegramName?: string
  telegramId?: string
}

interface Payment {
  id: string
  amount: number
  currency: string
  status: string
  provider: string
  purpose?: string
  description?: string
  createdAt: string
  paidAt?: string
  confirmedAt?: string
  meta?: string
  user: PaymentUser
  tariff?: { name: string }
}

interface PaymentStats {
  total: number
  paid: number
  pending: number
  failed?: number
  revenue: number
  todayRevenue?: number
}

interface ApiKey {
  id: string
  name: string
  key?: string
  isActive: boolean
  requestCount: number
  lastUsed?: string
  createdAt: string
}

/* ── Constants ─────────────────────────────────── */

const LIMIT = 30

const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  PAID:     { cls: 'bg-green-50 text-green-700 border border-green-200',    label: 'Оплачен' },
  PENDING:  { cls: 'bg-yellow-50 text-yellow-700 border border-yellow-200', label: 'Ожидает' },
  FAILED:   { cls: 'bg-red-50 text-red-700 border border-red-200',          label: 'Ошибка' },
  REFUNDED: { cls: 'bg-gray-50 text-gray-600 border border-gray-200',       label: 'Возврат' },
  EXPIRED:  { cls: 'bg-red-50 text-red-600 border border-red-200',          label: 'Истёк' },
}

const PROVIDER_LABEL: Record<string, string> = {
  YUKASSA:   'ЮKassa',
  CRYPTOPAY: 'CryptoPay',
  BALANCE:   'Баланс',
  MANUAL:    'Вручную',
  STARS:     'Stars',
}

/* ── Helpers ───────────────────────────────────── */

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin/payments${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  }).then(r => { if (!r.ok) throw new Error(); return r.json() })

function formatAmount(amount: number, currency: string) {
  if (currency === 'RUB') return `${Number(amount).toLocaleString('ru')} ₽`
  if (currency === 'USDT') return `${amount} USDT`
  if (currency === 'USD') return `$${amount}`
  return `${amount} ${currency}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
}

/* ── Component ─────────────────────────────────── */

export default function PaymentsPage() {
  const [tab, setTab] = useState<'payments' | 'keys'>('payments')

  // Payment state
  const [payments, setPayments] = useState<Payment[]>([])
  const [stats, setStats]       = useState<PaymentStats | null>(null)
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState('')
  const [provider, setProvider] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Keys state
  const [keys, setKeys]           = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState('')

  /* ── Load data ── */

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      if (provider) params.set('provider', provider)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)

      const [p, s, k] = await Promise.all([
        api(`/?${params}`),
        api('/stats').catch(() => null),
        api('/keys').catch(() => []),
      ])
      setPayments(p.payments ?? [])
      setTotal(p.total ?? 0)
      if (s) setStats(s)
      setKeys(Array.isArray(k) ? k : [])
    } catch {
      toast.error('Ошибка загрузки')
    }
    setLoading(false)
  }, [page, search, status, provider, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / LIMIT)

  const selectedPayment = useMemo(
    () => payments.find(p => p.id === selectedId) ?? null,
    [payments, selectedId],
  )

  /* ── Key actions ── */

  const createKey = async () => {
    if (!newKeyName.trim()) return
    try {
      const result = await api('/keys', { method: 'POST', body: JSON.stringify({ name: newKeyName }) })
      if (result.key) {
        await navigator.clipboard.writeText(result.key)
        toast.success(`Ключ создан и скопирован`)
      } else {
        toast.success('Ключ создан')
      }
      setNewKeyName('')
      load()
    } catch { toast.error('Ошибка') }
  }

  const deleteKey = async (id: string) => {
    if (!confirm('Удалить API ключ?')) return
    try {
      await api(`/keys/${id}`, { method: 'DELETE' })
      toast.success('Удалён')
      load()
    } catch { toast.error('Ошибка') }
  }

  function resetPage() { setPage(1) }

  /* ── Render ── */

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Платежи</h1>
          <p className="page-subtitle">
            {stats ? `${stats.paid} оплат · ${(stats.revenue ?? 0).toLocaleString('ru')} ₽` : `${total} записей`}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setTab('payments')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5 ${
              tab === 'payments' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-500'
            }`}
          >
            <CreditCard className="w-3 h-3" /> Платежи
          </button>
          <button
            onClick={() => setTab('keys')}
            className={`px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1.5 ${
              tab === 'keys' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-500'
            }`}
          >
            <Key className="w-3 h-3" /> API ключи
          </button>
        </div>
      </div>

      <div className="page-content">
        {tab === 'payments' ? (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
              <KpiCard icon={<CreditCard className="w-4 h-4" />} label="Всего" value={String(stats?.total ?? total)} color="#6366f1" />
              <KpiCard icon={<DollarSign className="w-4 h-4" />} label="Оплачено" value={String(stats?.paid ?? 0)} color="#10b981" />
              <KpiCard icon={<Clock className="w-4 h-4" />} label="Ожидает" value={String(stats?.pending ?? 0)} color="#f59e0b" />
              <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Выручка" value={`${(stats?.revenue ?? 0).toLocaleString('ru')} ₽`} color="#10b981" />
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); resetPage() }}
                  placeholder="Поиск по email, Telegram, ID..."
                  className="input pl-9"
                />
              </div>
              <select value={status} onChange={e => { setStatus(e.target.value); resetPage() }} className="input w-auto">
                <option value="">Все статусы</option>
                <option value="PAID">Оплачен</option>
                <option value="PENDING">Ожидает</option>
                <option value="FAILED">Ошибка</option>
                <option value="REFUNDED">Возврат</option>
              </select>
              <select value={provider} onChange={e => { setProvider(e.target.value); resetPage() }} className="input w-auto">
                <option value="">Все провайдеры</option>
                <option value="YUKASSA">ЮKassa</option>
                <option value="CRYPTOPAY">CryptoPay</option>
                <option value="BALANCE">Баланс</option>
                <option value="MANUAL">Вручную</option>
                <option value="STARS">Stars</option>
              </select>
            </div>

            {/* Date range */}
            <div className="flex gap-2 mb-4 flex-wrap items-center">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date" className="input w-auto py-1.5 text-xs" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); resetPage() }}
              />
              <span className="text-xs text-gray-400">--</span>
              <input
                type="date" className="input w-auto py-1.5 text-xs" value={dateTo}
                onChange={e => { setDateTo(e.target.value); resetPage() }}
              />
              {(dateFrom || dateTo) && (
                <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => { setDateFrom(''); setDateTo(''); resetPage() }}>
                  Сбросить
                </button>
              )}
            </div>

            {/* Table + detail panel */}
            <div className="flex gap-4">
              <div className={`bg-white rounded-xl border border-gray-100 overflow-hidden ${selectedId ? 'flex-1 min-w-0' : 'w-full'}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        {['Пользователь', 'Сумма', 'Тариф', 'Провайдер', 'Статус', 'Дата'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={6} className="text-center py-12">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-600" />
                        </td></tr>
                      ) : payments.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p>Платежи не найдены</p>
                        </td></tr>
                      ) : payments.map(p => (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
                          className={`border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 ${selectedId === p.id ? 'bg-primary-50' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              {p.user?.telegramName || p.user?.email?.split('@')[0] || '--'}
                            </div>
                            <div className="text-xs text-gray-400">{p.user?.email || p.user?.telegramId || '--'}</div>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 tabular-nums whitespace-nowrap">
                            {formatAmount(p.amount, p.currency)}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{p.tariff?.name || '—'}</td>
                          <td className="px-4 py-3">
                            <div>
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-50 text-gray-600 border border-gray-200">
                                {PROVIDER_LABEL[p.provider] || p.provider}
                              </span>
                              {p.description && (
                                <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[120px]">{p.description.split(' · ')[0]}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[p.status]?.cls || 'bg-gray-50 text-gray-600'}`}>
                              {STATUS_BADGE[p.status]?.label || p.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                            {fmtDate(p.createdAt)} {fmtTime(p.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      {Math.min((page - 1) * LIMIT + 1, total)}--{Math.min(page * LIMIT, total)} из {total}
                    </span>
                    <div className="flex gap-1 items-center">
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-100 transition-colors text-gray-500">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm px-2 text-gray-700">{page} / {totalPages}</span>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-100 transition-colors text-gray-500">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Detail panel */}
              {selectedPayment && (
                <DetailPanel payment={selectedPayment} onClose={() => setSelectedId(null)} />
              )}
            </div>
          </>
        ) : (
          /* ── API Keys tab ── */
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-1">Webhook API ключи</h3>
              <p className="text-xs text-gray-400 mb-4">
                Используйте API ключи для приёма платежей через webhook: POST /api/payments/webhook
              </p>

              <div className="flex gap-2 mb-4">
                <input
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="Название ключа"
                  className="input flex-1"
                  onKeyDown={e => e.key === 'Enter' && createKey()}
                />
                <button onClick={createKey} disabled={!newKeyName.trim()}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Создать
                </button>
              </div>

              <div className="space-y-2">
                {keys.map(k => (
                  <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <Key className="w-4 h-4 text-primary-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{k.name}</div>
                      <div className="text-xs text-gray-400">
                        {k.requestCount} запросов
                        {k.lastUsed && ` · Последний: ${new Date(k.lastUsed).toLocaleString('ru')}`}
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      k.isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-500 border border-gray-200'
                    }`}>
                      {k.isActive ? 'Активен' : 'Выключен'}
                    </span>
                    <button onClick={() => deleteKey(k.id)}
                      className="p-1.5 hover:bg-red-50 rounded transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
                {keys.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">Нет API ключей</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/* ── KPI Card ── */

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}12`, color }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-semibold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  )
}

/* ── Detail Panel ── */

function DetailPanel({ payment: p, onClose }: { payment: Payment; onClose: () => void }) {
  const parsedMeta = useMemo(() => {
    if (!p.meta) return null
    try { return typeof p.meta === 'string' ? JSON.parse(p.meta) : p.meta } catch { return null }
  }, [p.meta])

  return (
    <div className="bg-white rounded-xl border border-gray-100 w-[340px] shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Детали платежа</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-md transition-colors text-gray-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto max-h-[600px]">
        <DetailRow label="ID" value={p.id} mono />

        {/* User */}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Пользователь</p>
          {p.user?.id ? (
            <a href={`/admin/users/${p.user.id}`}
              className="text-sm font-medium text-primary-600 hover:underline inline-flex items-center gap-1">
              {p.user.telegramName || p.user.email?.split('@')[0] || '--'}
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <p className="text-sm text-gray-900">{p.user?.telegramName || p.user?.email?.split('@')[0] || '--'}</p>
          )}
          {p.user?.email && <p className="text-xs text-gray-400 mt-0.5">{p.user.email}</p>}
          {p.user?.telegramId && <p className="text-xs text-gray-400">TG: {p.user.telegramId}</p>}
        </div>

        {/* Status + Provider */}
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">Статус</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[p.status]?.cls || 'bg-gray-50 text-gray-600'}`}>
              {STATUS_BADGE[p.status]?.label || p.status}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">Провайдер</p>
            <p className="text-sm text-gray-900">{PROVIDER_LABEL[p.provider] || p.provider}</p>
          </div>
        </div>

        <DetailRow label="Сумма" value={formatAmount(p.amount, p.currency)} bold />
        {p.tariff?.name && <DetailRow label="Тариф" value={p.tariff.name} />}
        {p.description && <DetailRow label="Метод / Описание" value={p.description} />}
        {p.purpose && <DetailRow label="Цель" value={p.purpose} />}
        <DetailRow label="Создан" value={`${fmtDate(p.createdAt)} ${fmtTime(p.createdAt)}`} />
        {p.paidAt && <DetailRow label="Оплачен" value={`${fmtDate(p.paidAt)} ${fmtTime(p.paidAt)}`} />}

        {/* Promo from meta */}
        {parsedMeta?.promoCode && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Промокод</p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
              <Tag className="w-3 h-3" />
              {parsedMeta.promoCode}
              {parsedMeta.promoDiscount && ` -${parsedMeta.promoDiscount}%`}
            </span>
          </div>
        )}

        {/* Metadata */}
        {parsedMeta && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Метаданные</p>
            <div className="rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all bg-gray-50 text-gray-600 border border-gray-100">
              {JSON.stringify(parsedMeta, null, 2)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Detail Row ── */

function DetailRow({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm text-gray-900 ${mono ? 'font-mono text-xs break-all' : ''} ${bold ? 'font-semibold' : ''}`}>
        {value}
      </p>
    </div>
  )
}
