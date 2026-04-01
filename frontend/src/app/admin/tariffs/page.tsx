'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Edit2, Trash2, Loader2, Package, Eye, EyeOff, Save, X,
  Shield, Zap, Star, GripVertical, ChevronDown, Layers,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ── Types ─────────────────────────────────────── */

interface Tariff {
  id: string
  name: string
  description?: string
  durationDays: number
  priceRub: number
  priceUsdt?: number
  trafficGb?: number | null
  trafficAddonGb?: number
  deviceLimit: number
  isActive: boolean
  isVisible: boolean
  isTrial: boolean
  isFeatured?: boolean
  sortOrder: number
  type?: string
  trafficStrategy?: string
  remnawaveTag?: string
  remnawaveSquads?: string[]
  features?: string[]
  _count?: { payments?: number }
}

const EMPTY_FORM = {
  name: '',
  description: '',
  durationDays: 30,
  priceRub: 0,
  priceUsdt: 0,
  trafficGb: null as number | null,
  deviceLimit: 3,
  isActive: true,
  isVisible: true,
  isTrial: false,
  isFeatured: false,
  sortOrder: 0,
  type: 'SUBSCRIPTION' as string,
  trafficStrategy: 'MONTH',
  remnawaveTag: '',
  remnawaveSquads: [] as string[],
  features: [] as string[],
}

/* ── API ───────────────────────────────────────── */

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin/tariffs${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  }).then(r => { if (!r.ok) throw new Error(); return r.json() })

/* ── Main Page ─────────────────────────────────── */

export default function TariffsPage() {
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [featureInput, setFeatureInput] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'SUBSCRIPTION' | 'TRAFFIC_ADDON'>('SUBSCRIPTION')

  const load = useCallback(async () => {
    try {
      const data = await api('/')
      setTariffs(Array.isArray(data) ? data : data.tariffs ?? [])
    } catch { toast.error('Ошибка загрузки') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const upd = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name || !form.priceRub) return toast.error('Заполните название и цену')
    setSaving(true)
    try {
      const payload = { ...form }
      if (editId) {
        await api(`/${editId}`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success('Тариф обновлён')
      } else {
        await api('/', { method: 'POST', body: JSON.stringify(payload) })
        toast.success('Тариф создан')
      }
      setShowForm(false)
      setEditId(null)
      setForm({ ...EMPTY_FORM })
      load()
    } catch { toast.error('Ошибка сохранения') }
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Удалить тариф?')) return
    try {
      await api(`/${id}`, { method: 'DELETE' })
      toast.success('Удалён')
      load()
    } catch { toast.error('Ошибка') }
  }

  const edit = (t: Tariff) => {
    setForm({
      name: t.name,
      description: t.description || '',
      durationDays: t.durationDays,
      priceRub: Number(t.priceRub),
      priceUsdt: Number(t.priceUsdt || 0),
      trafficGb: t.trafficGb ?? null,
      deviceLimit: t.deviceLimit,
      isActive: t.isActive,
      isVisible: t.isVisible,
      isTrial: t.isTrial,
      isFeatured: t.isFeatured ?? false,
      sortOrder: t.sortOrder ?? 0,
      type: t.type || 'SUBSCRIPTION',
      trafficStrategy: t.trafficStrategy || 'MONTH',
      remnawaveTag: t.remnawaveTag || '',
      remnawaveSquads: t.remnawaveSquads || [],
      features: t.features || [],
    })
    setEditId(t.id)
    setShowForm(true)
  }

  const addFeature = () => {
    if (!featureInput.trim()) return
    upd('features', [...form.features, featureInput.trim()])
    setFeatureInput('')
  }

  const removeFeature = (i: number) => {
    upd('features', form.features.filter((_, idx) => idx !== i))
  }

  const subs = tariffs.filter(t => (t.type || 'SUBSCRIPTION') === 'SUBSCRIPTION')
  const addons = tariffs.filter(t => t.type === 'TRAFFIC_ADDON')
  const filtered = tab === 'SUBSCRIPTION' ? subs : addons

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Тарифы</h1>
          <p className="page-subtitle">{subs.length} подписок · {addons.length} пакетов трафика</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm({ ...EMPTY_FORM, type: tab }) }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Создать
        </button>
      </div>

      <div className="page-content">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {([['SUBSCRIPTION', 'Подписки', Shield, subs.length], ['TRAFFIC_ADDON', 'Доп. трафик', Zap, addons.length]] as const).map(([key, label, Icon, count]) => (
            <button key={key} onClick={() => setTab(key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key ? 'bg-primary-50 text-primary-600 border border-primary-200' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              <Icon className="w-4 h-4" /> {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === key ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Tariff cards */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <Package className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500">Нет тарифов</p>
            <p className="text-xs text-gray-400 mt-1">Создайте первый тариф</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => (
              <div key={t.id} className={`bg-white rounded-xl border border-gray-100 overflow-hidden transition-all ${!t.isActive ? 'opacity-60' : ''}`}>
                {/* Card header */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary-50">
                    {t.type === 'TRAFFIC_ADDON'
                      ? <Zap className="w-5 h-5 text-amber-600" />
                      : <Package className="w-5 h-5 text-primary-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">{t.name}</span>
                      {t.isTrial && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">Trial</span>}
                      {t.isFeatured && <Star className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />}
                      {!t.isVisible && <EyeOff className="w-3.5 h-3.5 text-gray-300" />}
                      {!t.isActive && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-500">Неактивен</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {t.type === 'TRAFFIC_ADDON'
                        ? `+${t.trafficAddonGb || t.trafficGb || '?'} ГБ`
                        : `${t.durationDays} дн. · ${t.trafficGb ? t.trafficGb + ' ГБ' : 'Безлимит'} · ${t.deviceLimit} устр.`
                      }
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">{Number(t.priceRub).toLocaleString('ru')} ₽</div>
                      {t.priceUsdt ? <div className="text-xs text-gray-400">{Number(t.priceUsdt)} USDT</div> : null}
                    </div>
                    <span className="text-xs text-gray-300">{t._count?.payments || 0} оплат</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === t.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === t.id && (
                  <div className="px-5 pb-4 pt-2 border-t border-gray-100">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                      <div><span className="text-gray-400">Срок:</span> <b className="text-gray-900">{t.durationDays} дней</b></div>
                      <div><span className="text-gray-400">Трафик:</span> <b className="text-gray-900">{t.trafficGb ? `${t.trafficGb} ГБ` : 'Безлимит'}</b></div>
                      <div><span className="text-gray-400">Устройств:</span> <b className="text-gray-900">{t.deviceLimit}</b></div>
                      <div><span className="text-gray-400">Стратегия:</span> <b className="text-gray-900">{t.trafficStrategy || 'MONTH'}</b></div>
                      <div><span className="text-gray-400">Порядок:</span> <b className="text-gray-900">{t.sortOrder}</b></div>
                      {t.remnawaveTag && <div><span className="text-gray-400">REMNAWAVE:</span> <b className="text-gray-900 font-mono">{t.remnawaveTag}</b></div>}
                    </div>
                    {t.description && <p className="text-xs text-gray-400 mb-3">{t.description}</p>}
                    {t.features && t.features.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Особенности:</p>
                        <div className="flex flex-wrap gap-1">
                          {t.features.map((f, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary-50 text-primary-700 border border-primary-100">
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2 border-t border-gray-50">
                      <button onClick={() => edit(t)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors">
                        <Edit2 className="w-3 h-3" /> Редактировать
                      </button>
                      <button onClick={() => del(t.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3 h-3" /> Удалить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal form ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-900">{editId ? 'Редактировать тариф' : 'Новый тариф'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Type selector */}
              <div className="flex gap-2">
                {([['SUBSCRIPTION', 'Подписка', Shield], ['TRAFFIC_ADDON', 'Доп. трафик', Zap]] as const).map(([key, label, Icon]) => (
                  <button key={key} onClick={() => upd('type', key)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 justify-center transition-all ${
                      form.type === key ? 'bg-primary-50 text-primary-600 border border-primary-200' : 'bg-gray-50 border border-gray-200 text-gray-500'
                    }`}>
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>

              {/* Name + description */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Название *</label>
                <input value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Базовый · 1 месяц" className="input" autoFocus />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Описание</label>
                <textarea value={form.description} onChange={e => upd('description', e.target.value)} placeholder="Описание тарифа" className="input h-16 resize-y" />
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Цена (₽) *</label>
                  <input type="number" value={form.priceRub} onChange={e => upd('priceRub', +e.target.value)} className="input" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Цена (USDT)</label>
                  <input type="number" step="0.01" value={form.priceUsdt || ''} onChange={e => upd('priceUsdt', +e.target.value)} className="input" />
                </div>
              </div>

              {/* Duration, traffic, devices */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Дней</label>
                  <input type="number" value={form.durationDays} onChange={e => upd('durationDays', +e.target.value)} className="input" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Трафик (ГБ)</label>
                  <input type="number" value={form.trafficGb ?? ''} onChange={e => upd('trafficGb', e.target.value ? +e.target.value : null)} className="input" placeholder="Безлимит" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Устройств</label>
                  <input type="number" value={form.deviceLimit} onChange={e => upd('deviceLimit', +e.target.value)} className="input" />
                </div>
              </div>

              {/* Traffic strategy */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Стратегия трафика</label>
                <select value={form.trafficStrategy} onChange={e => upd('trafficStrategy', e.target.value)} className="input">
                  <option value="MONTH">MONTH -- сброс раз в месяц</option>
                  <option value="NO_RESET">NO_RESET -- не сбрасывается</option>
                  <option value="WEEK">WEEK -- сброс раз в неделю</option>
                </select>
              </div>

              {/* REMNAWAVE tag */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">REMNAWAVE тег</label>
                <input value={form.remnawaveTag} onChange={e => upd('remnawaveTag', e.target.value)} className="input font-mono" placeholder="premium / basic / ..." />
              </div>

              {/* Sort order */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Порядок сортировки</label>
                <input type="number" value={form.sortOrder} onChange={e => upd('sortOrder', +e.target.value)} className="input w-24" />
              </div>

              {/* Features list */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Особенности</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {form.features.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-primary-50 text-primary-700 border border-primary-100">
                      {f}
                      <button onClick={() => removeFeature(i)} className="hover:text-red-500 ml-0.5">x</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={featureInput}
                    onChange={e => setFeatureInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                    placeholder="Добавить особенность..."
                    className="input flex-1 text-xs"
                  />
                  <button onClick={addFeature} className="px-3 py-1.5 rounded-lg text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={e => upd('isActive', e.target.checked)} className="rounded" />
                  Активен
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isVisible} onChange={e => upd('isVisible', e.target.checked)} className="rounded" />
                  Видимый
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isTrial} onChange={e => upd('isTrial', e.target.checked)} className="rounded" />
                  Пробный
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isFeatured} onChange={e => upd('isFeatured', e.target.checked)} className="rounded" />
                  Рекомендованный
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
              <button onClick={save} disabled={saving || !form.name}
                className="bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <Save className="w-4 h-4" />
                {editId ? 'Сохранить' : 'Создать'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
