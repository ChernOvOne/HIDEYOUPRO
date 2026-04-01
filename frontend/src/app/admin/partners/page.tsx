'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Loader2, DollarSign, TrendingUp, Users, Percent } from 'lucide-react'
import toast from 'react-hot-toast'

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin/partners${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...opts?.headers }, ...opts }).then(r => { if (!r.ok) throw new Error(); return r.json() })

const COLORS = ['#534AB7', '#1D9E75', '#BA7517', '#E24B4A', '#378ADD', '#D4537E', '#639922']

export default function PartnersPage() {
  const [partners, setPartners] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showInkas, setShowInkas] = useState<string | null>(null)
  const [inkasForm, setInkasForm] = useState({ type: 'DIVIDEND' as string, amount: '', date: new Date().toISOString().split('T')[0], description: '' })
  const [form, setForm] = useState({ name: '', roleLabel: '', tgUsername: '', sharePercent: 0, notes: '', initialInvestment: 0 })

  const load = useCallback(async () => {
    try { setPartners(await api('/')) } catch { toast.error('Ошибка') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createPartner = async () => {
    if (!form.name) return
    await api('/', { method: 'POST', body: JSON.stringify({ ...form, avatarColor: COLORS[partners.length % COLORS.length], initials: form.name.slice(0, 2).toUpperCase() }) })
    setShowForm(false)
    setForm({ name: '', roleLabel: '', tgUsername: '', sharePercent: 0, notes: '', initialInvestment: 0 })
    toast.success('Партнёр создан')
    load()
  }

  const addInkas = async () => {
    if (!showInkas || !inkasForm.amount) return
    await api('/inkas', { method: 'POST', body: JSON.stringify({ partnerId: showInkas, ...inkasForm, amount: parseFloat(inkasForm.amount) }) })
    setInkasForm({ type: 'DIVIDEND', amount: '', date: new Date().toISOString().split('T')[0], description: '' })
    toast.success('Записано')
    load()
  }

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Партнёры и инвесторы</h1>
          <p className="page-subtitle">{partners.length} партнёров</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs"><Plus className="w-3.5 h-3.5" /> Добавить</button>
      </div>

      <div className="page-content">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {partners.map(p => (
            <div key={p.id} className="card-p cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setShowInkas(showInkas === p.id ? null : p.id)}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: p.avatarColor || '#534AB7' }}>
                  {p.initials || p.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.roleLabel || 'Партнёр'} {p.tgUsername && `· @${p.tgUsername}`}</div>
                </div>
                <div className="ml-auto badge-info"><Percent className="w-3 h-3 mr-0.5" />{Number(p.sharePercent)}%</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xs text-gray-400">Вложил</div>
                  <div className="text-sm font-medium">{(p.totalInvested || 0).toLocaleString('ru')} ₽</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Возвращено</div>
                  <div className="text-sm font-medium text-success-700">{(p.totalReturned || 0).toLocaleString('ru')} ₽</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Долг</div>
                  <div className="text-sm font-medium text-danger-700">{(p.debt || 0).toLocaleString('ru')} ₽</div>
                </div>
              </div>

              {showInkas === p.id && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex gap-2 mb-2">
                    <select value={inkasForm.type} onChange={e => setInkasForm(f => ({ ...f, type: e.target.value }))} className="input text-xs w-auto">
                      <option value="DIVIDEND">Дивиденд</option>
                      <option value="RETURN_INV">Возврат</option>
                      <option value="INVESTMENT">Инвестиция</option>
                    </select>
                    <input type="number" value={inkasForm.amount} onChange={e => setInkasForm(f => ({ ...f, amount: e.target.value }))} placeholder="Сумма" className="input text-xs flex-1" />
                    <button onClick={addInkas} className="btn-primary text-xs px-3"><Plus className="w-3 h-3" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* New partner modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowForm(false)}>
          <div className="card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">Новый партнёр</h3>
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Имя *" className="input" autoFocus />
              <input value={form.roleLabel} onChange={e => setForm(f => ({ ...f, roleLabel: e.target.value }))} placeholder="Роль (инвестор, партнёр...)" className="input" />
              <input value={form.tgUsername} onChange={e => setForm(f => ({ ...f, tgUsername: e.target.value }))} placeholder="Telegram username" className="input" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={form.sharePercent} onChange={e => setForm(f => ({ ...f, sharePercent: +e.target.value }))} placeholder="Доля %" className="input" />
                <input type="number" value={form.initialInvestment} onChange={e => setForm(f => ({ ...f, initialInvestment: +e.target.value }))} placeholder="Начальные вложения" className="input" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={createPartner} disabled={!form.name} className="btn-primary flex-1">Создать</button>
              <button onClick={() => setShowForm(false)} className="btn-default px-4">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
