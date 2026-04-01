'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Search, ChevronLeft, ChevronRight, Loader2, Eye, Shield, Mail, MessageCircle, Calendar, DollarSign, Tag, Download } from 'lucide-react'
import toast from 'react-hot-toast'

const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin/users${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...opts?.headers }, ...opts }).then(r => { if (!r.ok) throw new Error(); return r.json() })

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers]     = useState<any[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [loading, setLoading] = useState(true)

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

  const statusBadge = (s: string) => {
    switch (s) {
      case 'ACTIVE':   return <span className="badge-success">Активный</span>
      case 'EXPIRED':  return <span className="badge-danger">Истёк</span>
      case 'TRIAL':    return <span className="badge-warn">Пробный</span>
      default:         return <span className="badge-gray">Неактивный</span>
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Пользователи</h1>
          <p className="page-subtitle">{total} всего</p>
        </div>
        <button
          onClick={() => {
            const params = new URLSearchParams()
            params.set('export', 'csv')
            if (search) params.set('search', search)
            if (status) params.set('status', status)
            const url = `/api/admin/users?${params}`
            const a = document.createElement('a')
            a.href = url
            a.download = `users-${new Date().toISOString().split('T')[0]}.csv`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            toast.success('Экспорт CSV начат')
          }}
          className="bg-primary-600 text-white px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-primary-700 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Экспорт CSV
        </button>
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
            <option value="active">Активный</option>
            <option value="inactive">Неактивный</option>
            <option value="expired">Истёк</option>
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
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Пользователи не найдены</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="table-row cursor-pointer" onClick={() => router.push(`/admin/users/${u.id}`)}>
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
                    <span className="font-medium">{Number(u.totalPaid || 0).toLocaleString('ru')} &#8381;</span>
                    <span className="text-xs text-gray-400 ml-1">({u.paymentsCount} опл.)</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {u.utmCode ? <span className="badge-info">{u.utmCode}</span> : <span className="text-gray-300">&mdash;</span>}
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
            <span className="text-xs text-gray-400">Стр. {page} из {Math.ceil(total / 20)}</span>
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
    </>
  )
}
