'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Loader2, ChevronLeft, ChevronRight, CreditCard, Key, Plus, Copy, Trash2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin/payments${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...opts?.headers }, ...opts }).then(r => { if (!r.ok) throw new Error(); return r.json() })

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [stats, setStats]       = useState<any>(null)
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'payments' | 'keys'>('payments')
  const [keys, setKeys]         = useState<any[]>([])
  const [newKeyName, setNewKeyName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const [p, s, k] = await Promise.all([
        api(`/?${params}`),
        api('/stats'),
        api('/keys'),
      ])
      setPayments(p.payments); setTotal(p.total); setStats(s); setKeys(k)
    } catch { toast.error('Ошибка') }
    setLoading(false)
  }, [page, search, status])

  useEffect(() => { load() }, [load])

  const createKey = async () => {
    if (!newKeyName) return
    const result = await api('/keys', { method: 'POST', body: JSON.stringify({ name: newKeyName }) })
    await navigator.clipboard.writeText(result.key)
    toast.success(`Ключ создан и скопирован: ${result.key.slice(0, 20)}...`)
    setNewKeyName('')
    load()
  }

  const deleteKey = async (id: string) => {
    if (!confirm('Удалить API ключ?')) return
    await api(`/keys/${id}`, { method: 'DELETE' })
    toast.success('Удалён'); load()
  }

  const statusBadge = (s: string) => {
    switch (s) {
      case 'PAID':    return <span className="badge-success">Оплачен</span>
      case 'PENDING': return <span className="badge-warn">Ожидает</span>
      case 'FAILED':  return <span className="badge-danger">Ошибка</span>
      default:        return <span className="badge-gray">{s}</span>
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Платежи</h1>
          <p className="page-subtitle">{stats?.paid || 0} оплат · {(stats?.revenue || 0).toLocaleString('ru')} ₽</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setTab('payments')} className={`px-3 py-1.5 text-xs rounded-lg transition-all ${tab === 'payments' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>Платежи</button>
          <button onClick={() => setTab('keys')} className={`px-3 py-1.5 text-xs rounded-lg transition-all ${tab === 'keys' ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-500'}`}><Key className="w-3 h-3 inline mr-1" />API ключи</button>
        </div>
      </div>

      <div className="page-content">
        {tab === 'payments' ? (
          <>
            {/* KPI */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="kpi-card"><div className="kpi-label">Всего</div><div className="kpi-value">{stats?.total || 0}</div></div>
              <div className="kpi-card"><div className="kpi-label">Оплачено</div><div className="kpi-value text-success-700">{stats?.paid || 0}</div></div>
              <div className="kpi-card"><div className="kpi-label">Ожидает</div><div className="kpi-value text-warn-700">{stats?.pending || 0}</div></div>
              <div className="kpi-card"><div className="kpi-label">Выручка</div><div className="kpi-value">{(stats?.revenue || 0).toLocaleString('ru')} ₽</div></div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Поиск..." className="input pl-9" />
              </div>
              <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="input w-auto">
                <option value="">Все</option>
                <option value="PAID">Оплачен</option>
                <option value="PENDING">Ожидает</option>
                <option value="FAILED">Ошибка</option>
              </select>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  <th className="table-header text-left px-4 py-3">Пользователь</th>
                  <th className="table-header text-left px-4 py-3">Сумма</th>
                  <th className="table-header text-left px-4 py-3 hidden md:table-cell">Провайдер</th>
                  <th className="table-header text-left px-4 py-3 hidden md:table-cell">Статус</th>
                  <th className="table-header text-left px-4 py-3">Дата</th>
                </tr></thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-600" /></td></tr>
                  ) : payments.map(p => (
                    <tr key={p.id} className="table-row">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{p.user?.telegramName || p.user?.email || '—'}</div>
                        <div className="text-xs text-gray-400">{p.tariff?.name || p.description || '—'}</div>
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums">{Number(p.amount).toLocaleString('ru')} {p.currency}</td>
                      <td className="px-4 py-3 hidden md:table-cell"><span className="badge-gray">{p.provider}</span></td>
                      <td className="px-4 py-3 hidden md:table-cell">{statusBadge(p.status)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(p.createdAt).toLocaleString('ru')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {total > 30 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-gray-400">Стр. {page}/{Math.ceil(total / 30)}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-default px-2 py-1"><ChevronLeft className="w-4 h-4" /></button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 30)} className="btn-default px-2 py-1"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* API Keys tab */
          <div className="space-y-4">
            <div className="card-p">
              <h3 className="text-sm font-medium mb-3">Webhook API ключи</h3>
              <p className="text-xs text-gray-400 mb-4">Используйте API ключи для приёма платежей через webhook: POST /api/payments/webhook</p>
              <div className="flex gap-2 mb-4">
                <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Название ключа" className="input flex-1" onKeyDown={e => e.key === 'Enter' && createKey()} />
                <button onClick={createKey} disabled={!newKeyName} className="btn-primary text-xs"><Plus className="w-3.5 h-3.5" /> Создать</button>
              </div>
              <div className="space-y-2">
                {keys.map(k => (
                  <div key={k.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                    <Key className="w-4 h-4 text-primary-600" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{k.name}</div>
                      <div className="text-xs text-gray-400">
                        {k.requestCount} запросов
                        {k.lastUsed && ` · Последний: ${new Date(k.lastUsed).toLocaleString('ru')}`}
                      </div>
                    </div>
                    <span className={k.isActive ? 'badge-success' : 'badge-gray'}>{k.isActive ? 'Активен' : 'Выключен'}</span>
                    <button onClick={() => deleteKey(k.id)} className="p-1.5 hover:bg-danger-50 rounded"><Trash2 className="w-3.5 h-3.5 text-gray-400" /></button>
                  </div>
                ))}
                {keys.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Нет ключей</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
