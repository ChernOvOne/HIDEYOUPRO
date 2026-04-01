'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, Search, ChevronLeft, ChevronRight, Loader2, Eye, MoreHorizontal, Shield, Mail, MessageCircle, Calendar, DollarSign, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin/users${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...opts?.headers }, ...opts }).then(r => { if (!r.ok) throw new Error(); return r.json() })

export default function UsersPage() {
  const [users, setUsers]     = useState<any[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (status) params.set('status', status)
      const data = await apiFetch(`/?${params}`)
      setUsers(data.users)
      setTotal(data.total)
    } catch { toast.error('Ошибка загрузки') }
    setLoading(false)
  }, [page, search, status])

  useEffect(() => { load() }, [load])

  const openDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const user = await apiFetch(`/${id}`)
      setSelected(user)
    } catch { toast.error('Ошибка') }
    setDetailLoading(false)
  }

  const statusBadge = (s: string) => {
    switch (s) {
      case 'ACTIVE':   return <span className="badge-success">Active</span>
      case 'EXPIRED':  return <span className="badge-danger">Expired</span>
      case 'TRIAL':    return <span className="badge-warn">Trial</span>
      default:         return <span className="badge-gray">Inactive</span>
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Пользователи</h1>
          <p className="page-subtitle">{total} всего</p>
        </div>
      </div>

      <div className="page-content">
        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Поиск по email, TG, ID..." className="input pl-9" />
          </div>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="input w-auto">
            <option value="">Все статусы</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header text-left px-4 py-3">Пользователь</th>
                <th className="table-header text-left px-4 py-3 hidden md:table-cell">Статус</th>
                <th className="table-header text-left px-4 py-3 hidden lg:table-cell">LTV</th>
                <th className="table-header text-left px-4 py-3 hidden lg:table-cell">UTM</th>
                <th className="table-header text-left px-4 py-3 hidden md:table-cell">Дата</th>
                <th className="table-header px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-600" /></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Нет пользователей</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="table-row cursor-pointer" onClick={() => openDetail(u.id)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-medium">
                        {(u.telegramName || u.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{u.telegramName || u.email || u.telegramId}</div>
                        <div className="text-xs text-gray-400">{u.email || u.telegramId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">{statusBadge(u.subStatus)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="font-medium">{Number(u.totalPaid || 0).toLocaleString('ru')} ₽</span>
                    <span className="text-xs text-gray-400 ml-1">({u.paymentsCount} оплат)</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {u.utmCode ? <span className="badge-info">{u.utmCode}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-400 text-xs">
                    {new Date(u.createdAt).toLocaleDateString('ru')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Eye className="w-4 h-4 text-gray-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-gray-400">Страница {page} из {Math.ceil(total / 20)}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-default px-2 py-1">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)} className="btn-default px-2 py-1">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ User Detail Modal ═══ */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/40" onClick={() => setSelected(null)}>
          <div className="card w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-lg font-bold">
                  {(selected.telegramName || selected.email || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold">{selected.telegramName || selected.email}</h2>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {selected.email && <span className="text-xs text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" />{selected.email}</span>}
                    {selected.telegramId && <span className="text-xs text-gray-400 flex items-center gap-1"><MessageCircle className="w-3 h-3" />TG: {selected.telegramId}</span>}
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Shield className="w-3 h-3" />{selected.role}</span>
                  </div>
                </div>
                {statusBadge(selected.subStatus)}
              </div>
            </div>

            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="kpi-card">
                <div className="kpi-label">LTV</div>
                <div className="text-lg font-medium">{Number(selected.totalPaid || 0).toLocaleString('ru')} ₽</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Баланс</div>
                <div className="text-lg font-medium">{Number(selected.balance || 0)} ₽</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Бонус дни</div>
                <div className="text-lg font-medium">{selected.bonusDays || 0}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Рефералы</div>
                <div className="text-lg font-medium">{selected._count?.referrals || 0}</div>
              </div>
            </div>

            {/* Subscription info */}
            {selected.subExpireAt && (
              <div className="px-5 pb-3">
                <div className="p-3 rounded-lg bg-gray-50 text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>Подписка до: <b>{new Date(selected.subExpireAt).toLocaleDateString('ru')}</b></span>
                  {selected.remnawaveUuid && <span className="badge-info ml-auto">REMNAWAVE</span>}
                </div>
              </div>
            )}

            {/* Tags */}
            {selected.userTags?.length > 0 && (
              <div className="px-5 pb-3 flex gap-1 flex-wrap">
                {selected.userTags.map((t: any) => (
                  <span key={t.id} className="badge-info"><Tag className="w-3 h-3 mr-0.5" />{t.tag}</span>
                ))}
              </div>
            )}

            {/* Recent payments */}
            {selected.payments?.length > 0 && (
              <div className="px-5 pb-5">
                <h3 className="text-xs font-medium text-gray-400 uppercase mb-2">Последние оплаты</h3>
                <div className="space-y-1">
                  {selected.payments.slice(0, 5).map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                      <span>{Number(p.amount)} {p.currency}</span>
                      <span className={p.status === 'PAID' ? 'badge-success' : 'badge-gray'}>{p.status}</span>
                      <span className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString('ru')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {selected.adminNotesOnUser?.length > 0 && (
              <div className="px-5 pb-5">
                <h3 className="text-xs font-medium text-gray-400 uppercase mb-2">Заметки</h3>
                {selected.adminNotesOnUser.map((n: any) => (
                  <div key={n.id} className="p-2 rounded-lg bg-gray-50 text-sm mb-1">
                    <span className="text-gray-500">{n.note}</span>
                    <span className="text-xs text-gray-300 ml-2">— {n.author?.telegramName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
