'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Server, AlertTriangle, CheckCircle2, Clock, Loader2, Edit2, Trash2, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin/servers${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...opts?.headers }, ...opts }).then(r => { if (!r.ok) throw new Error(); return r.json() })

export default function ServersPage() {
  const [servers, setServers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', provider: '', ipAddress: '', purpose: '', panelUrl: '', monthlyCost: 0, currency: 'RUB', paymentDay: 1, nextPaymentDate: '', notes: '' })

  const load = useCallback(async () => {
    try { setServers(await api('/')) } catch { toast.error('Ошибка') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.name) return
    if (editId) {
      await api(`/${editId}`, { method: 'PUT', body: JSON.stringify(form) })
      toast.success('Обновлено')
    } else {
      await api('/', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Сервер добавлен')
    }
    setShowForm(false); setEditId(null)
    setForm({ name: '', provider: '', ipAddress: '', purpose: '', panelUrl: '', monthlyCost: 0, currency: 'RUB', paymentDay: 1, nextPaymentDate: '', notes: '' })
    load()
  }

  const del = async (id: string) => {
    if (!confirm('Удалить сервер?')) return
    await api(`/${id}`, { method: 'DELETE' })
    toast.success('Удалён')
    load()
  }

  const edit = (s: any) => {
    setForm({ name: s.name, provider: s.provider || '', ipAddress: s.ipAddress || '', purpose: s.purpose || '', panelUrl: s.panelUrl || '', monthlyCost: Number(s.monthlyCost), currency: s.currency, paymentDay: s.paymentDay || 1, nextPaymentDate: s.nextPaymentDate ? new Date(s.nextPaymentDate).toISOString().split('T')[0] : '', notes: s.notes || '' })
    setEditId(s.id)
    setShowForm(true)
  }

  const statusIcon = (s: any) => {
    switch (s.computedStatus) {
      case 'ACTIVE':  return <CheckCircle2 className="w-4 h-4 text-success-700" />
      case 'WARNING': return <AlertTriangle className="w-4 h-4 text-warn-700" />
      case 'EXPIRED': return <Clock className="w-4 h-4 text-danger-700" />
      default:        return <Server className="w-4 h-4 text-gray-400" />
    }
  }

  const totalCost = servers.reduce((s, sv) => s + Number(sv.monthlyCost), 0)

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Серверы</h1>
          <p className="page-subtitle">{servers.length} серверов · {totalCost.toLocaleString('ru')} ₽/мес</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', provider: '', ipAddress: '', purpose: '', panelUrl: '', monthlyCost: 0, currency: 'RUB', paymentDay: 1, nextPaymentDate: '', notes: '' }) }} className="btn-primary text-xs">
          <Plus className="w-3.5 h-3.5" /> Добавить
        </button>
      </div>

      <div className="page-content">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {servers.map(s => (
            <div key={s.id} className="card-p">
              <div className="flex items-center gap-2 mb-3">
                {statusIcon(s)}
                <span className="font-medium text-sm flex-1">{s.name}</span>
                <span className="text-sm font-medium tabular-nums">{Number(s.monthlyCost).toLocaleString('ru')} {s.currency}/мес</span>
              </div>
              <div className="space-y-1 text-xs text-gray-400">
                {s.provider && <div>Провайдер: {s.provider}</div>}
                {s.ipAddress && <div>IP: <span className="font-mono text-gray-600">{s.ipAddress}</span></div>}
                {s.purpose && <div>Назначение: {s.purpose}</div>}
                {s.daysUntilPayment !== null && (
                  <div className={s.daysUntilPayment <= 0 ? 'text-danger-700 font-medium' : s.daysUntilPayment <= 3 ? 'text-warn-700' : ''}>
                    Оплата: {s.daysUntilPayment <= 0 ? 'просрочена!' : `через ${s.daysUntilPayment} дн.`}
                  </div>
                )}
              </div>
              <div className="flex gap-1 mt-3 pt-2 border-t border-gray-50">
                {s.panelUrl && (
                  <a href={s.panelUrl} target="_blank" rel="noopener" className="btn-ghost text-xs px-2 py-1"><ExternalLink className="w-3 h-3" /> Панель</a>
                )}
                <button onClick={() => edit(s)} className="btn-ghost text-xs px-2 py-1 ml-auto"><Edit2 className="w-3 h-3" /></button>
                <button onClick={() => del(s.id)} className="btn-ghost text-xs px-2 py-1 text-danger-600"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowForm(false)}>
          <div className="card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">{editId ? 'Редактировать' : 'Новый сервер'}</h3>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Название *" className="input" autoFocus />
              <div className="grid grid-cols-2 gap-2">
                <input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} placeholder="Провайдер" className="input" />
                <input value={form.ipAddress} onChange={e => setForm(f => ({ ...f, ipAddress: e.target.value }))} placeholder="IP адрес" className="input" />
              </div>
              <input value={form.panelUrl} onChange={e => setForm(f => ({ ...f, panelUrl: e.target.value }))} placeholder="URL панели" className="input" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={form.monthlyCost} onChange={e => setForm(f => ({ ...f, monthlyCost: +e.target.value }))} placeholder="Стоимость/мес" className="input" />
                <input type="date" value={form.nextPaymentDate} onChange={e => setForm(f => ({ ...f, nextPaymentDate: e.target.value }))} className="input" />
              </div>
              <input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} placeholder="Назначение" className="input" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={save} disabled={!form.name} className="btn-primary flex-1">{editId ? 'Сохранить' : 'Создать'}</button>
              <button onClick={() => setShowForm(false)} className="btn-default px-4">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
