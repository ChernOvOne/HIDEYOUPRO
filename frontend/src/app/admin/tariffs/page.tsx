'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit2, Trash2, Loader2, Package, Eye, EyeOff, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin/tariffs${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...opts?.headers }, ...opts }).then(r => { if (!r.ok) throw new Error(); return r.json() })

const emptyForm = { name: '', description: '', priceRub: 0, priceUsdt: 0, durationDays: 30, trafficGb: null as number | null, deviceLimit: 3, isActive: true, isVisible: true, isTrial: false, remnawaveTag: '', remnawaveSquads: [] as string[], trafficStrategy: 'MONTH' }

export default function TariffsPage() {
  const [tariffs, setTariffs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try { setTariffs(await api('/')) } catch { toast.error('Ошибка') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const upd = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name || !form.priceRub) return
    setSaving(true)
    try {
      if (editId) {
        await api(`/${editId}`, { method: 'PUT', body: JSON.stringify(form) })
        toast.success('Обновлено')
      } else {
        await api('/', { method: 'POST', body: JSON.stringify(form) })
        toast.success('Создано')
      }
      setShowForm(false); setEditId(null); setForm({ ...emptyForm }); load()
    } catch { toast.error('Ошибка') }
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Удалить тариф?')) return
    await api(`/${id}`, { method: 'DELETE' })
    toast.success('Удалён'); load()
  }

  const edit = (t: any) => {
    setForm({ name: t.name, description: t.description || '', priceRub: Number(t.priceRub), priceUsdt: Number(t.priceUsdt || 0), durationDays: t.durationDays, trafficGb: t.trafficGb, deviceLimit: t.deviceLimit, isActive: t.isActive, isVisible: t.isVisible, isTrial: t.isTrial, remnawaveTag: t.remnawaveTag || '', remnawaveSquads: t.remnawaveSquads || [], trafficStrategy: t.trafficStrategy || 'MONTH' })
    setEditId(t.id); setShowForm(true)
  }

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Тарифы</h1>
          <p className="page-subtitle">{tariffs.length} тарифов</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ ...emptyForm }) }} className="btn-primary text-xs"><Plus className="w-3.5 h-3.5" /> Создать</button>
      </div>

      <div className="page-content">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tariffs.map(t => (
            <div key={t.id} className={`card-p ${!t.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-primary-600" />
                <span className="font-medium text-sm flex-1">{t.name}</span>
                {t.isTrial && <span className="badge-warn">Trial</span>}
                {!t.isVisible && <EyeOff className="w-3.5 h-3.5 text-gray-300" />}
              </div>
              {t.description && <p className="text-xs text-gray-400 mb-3">{t.description}</p>}
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div><span className="text-gray-400">Цена:</span> <b>{Number(t.priceRub)} ₽</b>{t.priceUsdt ? ` / ${Number(t.priceUsdt)} USDT` : ''}</div>
                <div><span className="text-gray-400">Срок:</span> <b>{t.durationDays} дней</b></div>
                <div><span className="text-gray-400">Трафик:</span> <b>{t.trafficGb ? `${t.trafficGb} ГБ` : 'Безлимит'}</b></div>
                <div><span className="text-gray-400">Устройств:</span> <b>{t.deviceLimit}</b></div>
              </div>
              <div className="flex gap-1 pt-2 border-t border-gray-50">
                <span className="text-xs text-gray-300 flex-1">{t._count?.payments || 0} оплат</span>
                <button onClick={() => edit(t)} className="btn-ghost text-xs px-2 py-1"><Edit2 className="w-3 h-3" /></button>
                <button onClick={() => del(t.id)} className="btn-ghost text-xs px-2 py-1 text-danger-600"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowForm(false)}>
          <div className="card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">{editId ? 'Редактировать' : 'Новый тариф'}</h3>
            <div className="space-y-3">
              <input value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Название *" className="input" autoFocus />
              <textarea value={form.description} onChange={e => upd('description', e.target.value)} placeholder="Описание" className="input h-16 resize-y" />
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500 mb-1 block">Цена (₽) *</label><input type="number" value={form.priceRub} onChange={e => upd('priceRub', +e.target.value)} className="input" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Цена (USDT)</label><input type="number" value={form.priceUsdt} onChange={e => upd('priceUsdt', +e.target.value)} className="input" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-xs text-gray-500 mb-1 block">Дней</label><input type="number" value={form.durationDays} onChange={e => upd('durationDays', +e.target.value)} className="input" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Трафик (ГБ)</label><input type="number" value={form.trafficGb ?? ''} onChange={e => upd('trafficGb', e.target.value ? +e.target.value : null)} className="input" placeholder="Безлимит" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Устройств</label><input type="number" value={form.deviceLimit} onChange={e => upd('deviceLimit', +e.target.value)} className="input" /></div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">REMNAWAVE тег</label>
                <input value={form.remnawaveTag} onChange={e => upd('remnawaveTag', e.target.value)} className="input" placeholder="optional tag" />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={e => upd('isActive', e.target.checked)} className="rounded" /> Активен</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.isVisible} onChange={e => upd('isVisible', e.target.checked)} className="rounded" /> Видимый</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.isTrial} onChange={e => upd('isTrial', e.target.checked)} className="rounded" /> Пробный</label>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={save} disabled={saving || !form.name} className="btn-primary flex-1 py-2.5">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editId ? 'Сохранить' : 'Создать'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-default px-4">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
