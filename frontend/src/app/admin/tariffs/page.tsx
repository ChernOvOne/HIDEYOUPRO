'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Trash2, Save, X, Star, Calendar, Package, Zap,
  ChevronDown, Shield, Sliders, Layers, Settings2, Eye,
  Smartphone, Clock, Wifi, ToggleLeft, ToggleRight,
  Loader2, Search, GripVertical,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ── Types ─────────────────────────────────────── */

interface TariffVariant {
  label: string
  days: number
  priceRub: number
  priceUsdt?: number
  trafficGb?: number
  deviceLimit?: number
}

interface ConfiguratorParam {
  pricePerUnit: number
  min: number
  max: number
  step: number
  default: number
}

interface TariffConfigurator {
  traffic?: ConfiguratorParam
  days?: ConfiguratorParam
  devices?: ConfiguratorParam
}

interface Tariff {
  id: string
  name: string
  description?: string
  type: 'SUBSCRIPTION' | 'TRAFFIC_ADDON'
  durationDays: number
  priceRub: number
  priceUsdt?: number
  deviceLimit: number
  trafficGb?: number | null
  trafficAddonGb?: number
  trafficStrategy?: string
  isActive: boolean
  isVisible: boolean
  isFeatured: boolean
  isTrial: boolean
  sortOrder: number
  remnawaveTag?: string
  remnawaveSquads?: string[]
  mode: 'simple' | 'variants' | 'configurator'
  variants?: TariffVariant[]
  configurator?: TariffConfigurator
  countries?: string
  protocol?: string
  speed?: string
  features?: string[]
}

const EMPTY_SUB: Partial<Tariff> = {
  type: 'SUBSCRIPTION',
  name: '',
  description: '',
  durationDays: 30,
  priceRub: 0,
  deviceLimit: 3,
  trafficStrategy: 'MONTH',
  isActive: true,
  isVisible: true,
  isFeatured: false,
  isTrial: false,
  sortOrder: 0,
  remnawaveSquads: [],
  mode: 'simple',
  features: [],
}

const EMPTY_ADDON: Partial<Tariff> = {
  type: 'TRAFFIC_ADDON',
  name: '',
  priceRub: 0,
  trafficAddonGb: 100,
  durationDays: 0,
  deviceLimit: 0,
  isActive: true,
  isVisible: true,
  isTrial: false,
  isFeatured: false,
  sortOrder: 0,
  remnawaveSquads: [],
  mode: 'simple',
}

const EMPTY_VARIANT: TariffVariant = { label: '', days: 30, priceRub: 0 }
const EMPTY_CFG_PARAM: ConfiguratorParam = { pricePerUnit: 0, min: 1, max: 100, step: 1, default: 10 }

const MODE_META = {
  simple:       { label: 'Простой',       icon: Package,  desc: 'Один тариф с фиксированной ценой' },
  variants:     { label: 'С вариантами',  icon: Layers,   desc: 'Несколько вариантов по длительности' },
  configurator: { label: 'Конфигуратор',  icon: Sliders,  desc: 'Пользователь выбирает параметры' },
} as const

/* ── API ───────────────────────────────────────── */

const api = async (method: string, path: string, body?: any) => {
  const r = await fetch(`/api/admin/tariffs${path}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

/* ================================================================
   COUNTRY PICKER
   ================================================================ */

const COUNTRIES = [
  { code: 'ru', name: 'Россия' }, { code: 'us', name: 'США' }, { code: 'gb', name: 'Великобритания' },
  { code: 'de', name: 'Германия' }, { code: 'nl', name: 'Нидерланды' }, { code: 'fi', name: 'Финляндия' },
  { code: 'pl', name: 'Польша' }, { code: 'fr', name: 'Франция' }, { code: 'jp', name: 'Япония' },
  { code: 'sg', name: 'Сингапур' }, { code: 'kr', name: 'Южная Корея' }, { code: 'ca', name: 'Канада' },
  { code: 'au', name: 'Австралия' }, { code: 'se', name: 'Швеция' }, { code: 'ch', name: 'Швейцария' },
  { code: 'at', name: 'Австрия' }, { code: 'it', name: 'Италия' }, { code: 'es', name: 'Испания' },
  { code: 'pt', name: 'Португалия' }, { code: 'br', name: 'Бразилия' }, { code: 'in', name: 'Индия' },
  { code: 'tr', name: 'Турция' }, { code: 'ae', name: 'ОАЭ' }, { code: 'il', name: 'Израиль' },
  { code: 'kz', name: 'Казахстан' }, { code: 'ua', name: 'Украина' }, { code: 'by', name: 'Беларусь' },
  { code: 'cz', name: 'Чехия' }, { code: 'ro', name: 'Румыния' }, { code: 'bg', name: 'Болгария' },
  { code: 'hu', name: 'Венгрия' }, { code: 'no', name: 'Норвегия' }, { code: 'dk', name: 'Дания' },
  { code: 'ie', name: 'Ирландия' }, { code: 'hk', name: 'Гонконг' }, { code: 'tw', name: 'Тайвань' },
  { code: 'th', name: 'Таиланд' }, { code: 'mx', name: 'Мексика' }, { code: 'ar', name: 'Аргентина' },
  { code: 'za', name: 'ЮАР' }, { code: 'ee', name: 'Эстония' }, { code: 'lv', name: 'Латвия' },
  { code: 'lt', name: 'Литва' }, { code: 'md', name: 'Молдова' }, { code: 'ge', name: 'Грузия' },
  { code: 'al', name: 'Албания' }, { code: 'rs', name: 'Сербия' }, { code: 'lu', name: 'Люксембург' },
]

function flagUrl(code: string) {
  return `https://flagcdn.com/16x12/${code}.png`
}

function parseCountries(str: string): Array<{ code: string; name: string }> {
  if (!str) return []
  return str.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const found = COUNTRIES.find(c => s.toLowerCase().includes(c.name.toLowerCase()) || s.toLowerCase().includes(c.code))
    return found || { code: 'xx', name: s }
  })
}

function serializeCountries(items: Array<{ code: string; name: string }>): string {
  return items.map(c => c.name).join(', ')
}

function CountryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const selected = parseCountries(value)
  const selectedCodes = new Set(selected.map(c => c.code))

  const filtered = COUNTRIES.filter(c =>
    !selectedCodes.has(c.code) &&
    (c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search.toLowerCase()))
  )

  const add = (country: typeof COUNTRIES[0]) => {
    const newList = [...selected, country]
    onChange(serializeCountries(newList))
    setSearch('')
  }

  const remove = (code: string) => {
    const newList = selected.filter(c => c.code !== code)
    onChange(serializeCountries(newList))
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(c => (
            <span key={c.code} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 border border-gray-200">
              <img src={flagUrl(c.code)} alt={c.code} className="w-4 h-3 rounded-sm object-cover" />
              <span className="text-gray-700">{c.name}</span>
              <button onClick={() => remove(c.code)} className="ml-0.5 text-gray-400 hover:text-red-500 transition-colors">&times;</button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Поиск страны..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
        {open && search.length > 0 && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl bg-white border border-gray-200 shadow-lg z-20">
            {filtered.slice(0, 10).map(c => (
              <button key={c.code} onMouseDown={() => { add(c); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                <img src={flagUrl(c.code)} alt={c.code} className="w-5 h-4 rounded-sm object-cover flex-shrink-0" />
                <span className="text-gray-700">{c.name}</span>
                <span className="text-[10px] ml-auto text-gray-400">{c.code.toUpperCase()}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ================================================================
   TARIFF FORM
   ================================================================ */

function TariffForm({ initial, onSave, onCancel }: {
  initial: Partial<Tariff>
  onSave: (t: Tariff) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<Partial<Tariff>>(initial)
  const [saving, setSaving] = useState(false)
  const [countries, setCountries] = useState(initial.countries ?? '')
  const [protocol, setProtocol] = useState(initial.protocol ?? '')
  const [speed, setSpeed] = useState(initial.speed ?? '')
  const [features, setFeatures] = useState<string[]>(initial.features ?? [])
  const [featureInput, setFeatureInput] = useState('')
  const [variants, setVariants] = useState<TariffVariant[]>(initial.variants ?? [])
  const [cfgTraffic, setCfgTraffic] = useState<ConfiguratorParam>(
    initial.configurator?.traffic ?? { ...EMPTY_CFG_PARAM, max: 500, default: 50, pricePerUnit: 2 }
  )
  const [cfgDays, setCfgDays] = useState<ConfiguratorParam>(
    initial.configurator?.days ?? { ...EMPTY_CFG_PARAM, min: 7, max: 365, step: 1, default: 30, pricePerUnit: 5 }
  )
  const [cfgDevices, setCfgDevices] = useState<ConfiguratorParam>(
    initial.configurator?.devices ?? { ...EMPTY_CFG_PARAM, min: 1, max: 10, step: 1, default: 3, pricePerUnit: 30 }
  )
  const [cfgEnabled, setCfgEnabled] = useState<{ traffic: boolean; days: boolean; devices: boolean }>({
    traffic: !!initial.configurator?.traffic,
    days: !!initial.configurator?.days,
    devices: !!initial.configurator?.devices,
  })
  const [showPreview, setShowPreview] = useState(false)

  const set = (k: keyof Tariff, v: any) => setForm(f => ({ ...f, [k]: v }))
  const mode = form.mode ?? 'simple'
  const isAddon = form.type === 'TRAFFIC_ADDON'

  const save = async () => {
    if (!form.name) return toast.error('Заполните название')
    setSaving(true)
    try {
      const isEdit = !!initial.id
      const payload: any = {
        ...form,
        countries: countries || undefined,
        protocol: protocol || undefined,
        speed: speed || undefined,
        features: features.length > 0 ? features : undefined,
      }
      if (mode === 'variants') {
        payload.variants = variants
        payload.configurator = null
      } else if (mode === 'configurator') {
        const cfg: any = {}
        if (cfgEnabled.traffic) cfg.traffic = cfgTraffic
        if (cfgEnabled.days) cfg.days = cfgDays
        if (cfgEnabled.devices) cfg.devices = cfgDevices
        payload.configurator = cfg
        payload.variants = null
      } else {
        payload.variants = null
        payload.configurator = null
      }
      const result = isEdit
        ? await api('PUT', `/${initial.id}`, payload)
        : await api('POST', '', payload)
      onSave(result)
      toast.success(isEdit ? 'Тариф обновлён' : 'Тариф создан')
    } catch { toast.error('Ошибка сохранения') }
    finally { setSaving(false) }
  }

  const addFeature = () => {
    if (!featureInput.trim()) return
    setFeatures(f => [...f, featureInput.trim()])
    setFeatureInput('')
  }

  const removeFeature = (idx: number) => {
    setFeatures(f => f.filter((_, i) => i !== idx))
  }

  const calcCfgPrice = () => {
    let p = 0
    if (cfgEnabled.traffic) p += cfgTraffic.default * cfgTraffic.pricePerUnit
    if (cfgEnabled.days) p += cfgDays.default * cfgDays.pricePerUnit
    if (cfgEnabled.devices) p += cfgDevices.default * cfgDevices.pricePerUnit
    return Math.round(p)
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1.5'

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
            {initial.id
              ? <Settings2 className="w-5 h-5 text-primary-600" />
              : <Plus className="w-5 h-5 text-primary-600" />}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {initial.id ? 'Редактировать тариф' : 'Новый тариф'}
            </h3>
            <p className="text-xs text-gray-400">
              {initial.id ? 'Измените параметры и сохраните' : 'Заполните параметры нового тарифа'}
            </p>
          </div>
        </div>
        <button onClick={onCancel} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Type selector */}
        <div className="flex gap-3">
          {(['SUBSCRIPTION', 'TRAFFIC_ADDON'] as const).map(t => {
            const active = form.type === t
            const isSub = t === 'SUBSCRIPTION'
            return (
              <button key={t} onClick={() => set('type', t)}
                className={`flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium transition-all flex-1 justify-center border
                  ${active
                    ? isSub ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                  }`}>
                {isSub ? <Shield className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                {isSub ? 'Подписка' : 'Доп. трафик'}
              </button>
            )
          })}
        </div>

        {/* Mode selector (subscriptions only) */}
        {!isAddon && (
          <div>
            <label className={labelCls}>Режим тарифа</label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(MODE_META) as [keyof typeof MODE_META, typeof MODE_META[keyof typeof MODE_META]][]).map(([key, meta]) => {
                const active = mode === key
                const Icon = meta.icon
                const colorMap = {
                  simple: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
                  variants: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-500' },
                  configurator: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
                }
                const colors = colorMap[key]
                return (
                  <button key={key} onClick={() => set('mode', key)}
                    className={`relative p-4 rounded-xl text-left transition-all duration-200 border
                      ${active ? `${colors.bg} ${colors.border}` : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                    <Icon className={`w-5 h-5 mb-2 ${active ? colors.text : 'text-gray-400'}`} />
                    <p className={`text-sm font-semibold mb-0.5 ${active ? colors.text : 'text-gray-700'}`}>
                      {meta.label}
                    </p>
                    <p className="text-[10px] leading-snug text-gray-400">{meta.desc}</p>
                    {active && (
                      <div className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full ${colors.dot}`} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Common fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <label className={labelCls}>Название *</label>
            <input value={form.name ?? ''} onChange={e => set('name', e.target.value)}
              placeholder={isAddon ? '+100 ГБ трафика' : 'Базовый - 1 месяц'}
              className={inputCls} />
          </div>

          <div className="col-span-2 space-y-1.5">
            <label className={labelCls}>Описание</label>
            <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)}
              placeholder="Краткое описание тарифа"
              className={`${inputCls} min-h-[60px]`} rows={2} />
          </div>

          {/* Countries picker */}
          <div className="col-span-2 space-y-1.5">
            <label className={labelCls}>Локации (необязательно)</label>
            <CountryPicker value={countries} onChange={setCountries} />
          </div>

          {/* Protocol */}
          <div className="space-y-1.5">
            <label className={labelCls}>Протокол</label>
            <input value={protocol} onChange={e => setProtocol(e.target.value)}
              placeholder="VLESS + XTLS Reality"
              className={inputCls} />
          </div>

          {/* Speed */}
          <div className="space-y-1.5">
            <label className={labelCls}>Скорость</label>
            <input value={speed} onChange={e => setSpeed(e.target.value)}
              placeholder="до 1 Гбит/с"
              className={inputCls} />
          </div>

          {/* Price fields */}
          {mode === 'simple' && (
            <>
              <div className="space-y-1.5">
                <label className={labelCls}>Цена ₽ *</label>
                <input type="number" value={form.priceRub ?? ''} onChange={e => set('priceRub', +e.target.value)}
                  className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Цена USDT</label>
                <input type="number" step="0.01" value={form.priceUsdt ?? ''} onChange={e => set('priceUsdt', +e.target.value || undefined)}
                  className={inputCls} />
              </div>
            </>
          )}
          {(mode === 'variants' || mode === 'configurator') && (
            <>
              <div className="space-y-1.5">
                <label className={labelCls}>Базовая цена ₽ (для отображения)</label>
                <input type="number" value={form.priceRub ?? ''} onChange={e => set('priceRub', +e.target.value)}
                  className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Базовая цена USDT</label>
                <input type="number" step="0.01" value={form.priceUsdt ?? ''} onChange={e => set('priceUsdt', +e.target.value || undefined)}
                  className={inputCls} />
              </div>
            </>
          )}
        </div>

        {/* ── VARIANTS MODE ── */}
        {!isAddon && mode === 'variants' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-medium text-gray-600">Варианты</label>
                <p className="text-[10px] mt-0.5 text-gray-400">Каждый вариант — отдельный период/цена</p>
              </div>
              <button onClick={() => setShowPreview(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-50 text-primary-600 border border-primary-100 hover:bg-primary-100 transition-colors">
                <Eye className="w-3.5 h-3.5" /> {showPreview ? 'Скрыть' : 'Превью'}
              </button>
            </div>

            {/* Variants table */}
            {variants.length > 0 && (
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <div className="grid grid-cols-[1fr_80px_90px_90px_70px_70px_40px] gap-2 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                  <span>Метка</span>
                  <span>Дней</span>
                  <span>Цена ₽</span>
                  <span>USDT</span>
                  <span>ГБ</span>
                  <span>Устр.</span>
                  <span></span>
                </div>
                {variants.map((v, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_90px_90px_70px_70px_40px] gap-2 px-4 py-2 items-center hover:bg-gray-50 transition-colors"
                    style={{ borderBottom: i < variants.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <input value={v.label} onChange={e => { const nv = [...variants]; nv[i] = { ...nv[i], label: e.target.value }; setVariants(nv) }}
                      placeholder="1 мес" className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                    <input type="number" value={v.days} onChange={e => { const nv = [...variants]; nv[i] = { ...nv[i], days: +e.target.value }; setVariants(nv) }}
                      className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                    <input type="number" value={v.priceRub} onChange={e => { const nv = [...variants]; nv[i] = { ...nv[i], priceRub: +e.target.value }; setVariants(nv) }}
                      className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                    <input type="number" step="0.01" value={v.priceUsdt ?? ''} onChange={e => { const nv = [...variants]; nv[i] = { ...nv[i], priceUsdt: +e.target.value || undefined }; setVariants(nv) }}
                      className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" placeholder="—" />
                    <input type="number" value={v.trafficGb ?? ''} onChange={e => { const nv = [...variants]; nv[i] = { ...nv[i], trafficGb: +e.target.value || undefined }; setVariants(nv) }}
                      className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" placeholder="---" />
                    <input type="number" value={v.deviceLimit ?? ''} onChange={e => { const nv = [...variants]; nv[i] = { ...nv[i], deviceLimit: +e.target.value || undefined }; setVariants(nv) }}
                      className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" placeholder="—" />
                    <button onClick={() => setVariants(vs => vs.filter((_, j) => j !== i))}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add variant button */}
            <button onClick={() => setVariants(v => [...v, { ...EMPTY_VARIANT }])}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-medium border-2 border-dashed border-gray-200 text-gray-400 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50/50 transition-all">
              <Plus className="w-4 h-4" /> Добавить вариант
            </button>

            {variants.length === 0 && (
              <p className="text-xs text-center py-4 text-gray-400">Добавьте хотя бы один вариант</p>
            )}

            {/* Preview */}
            {showPreview && variants.length > 0 && (
              <div className="rounded-xl p-4 space-y-3 bg-gray-50 border border-gray-200">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  Превью для пользователя
                </p>
                <div className="flex gap-2 flex-wrap">
                  {variants.map((v, i) => (
                    <button key={i}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border
                        ${i === 0 ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-white border-gray-200 text-gray-500'}`}>
                      {v.label || `${v.days} дн.`}
                    </button>
                  ))}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-gray-900">
                    {(variants[0]?.priceRub ?? 0).toLocaleString('ru')}
                  </span>
                  <span className="text-sm text-gray-400">&#8381;</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CONFIGURATOR MODE ── */}
        {!isAddon && mode === 'configurator' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-medium text-gray-600">Параметры конфигуратора</label>
                <p className="text-[10px] mt-0.5 text-gray-400">Включите параметры, которые может настроить пользователь</p>
              </div>
              <div className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                ~ {calcCfgPrice().toLocaleString('ru')} &#8381;
              </div>
            </div>

            {([
              { key: 'traffic' as const, label: 'Трафик (ГБ)', icon: Wifi, state: cfgTraffic, setState: setCfgTraffic, colorCls: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', iconBg: 'bg-blue-100' } },
              { key: 'days' as const, label: 'Период (дни)', icon: Calendar, state: cfgDays, setState: setCfgDays, colorCls: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-600', iconBg: 'bg-violet-100' } },
              { key: 'devices' as const, label: 'Устройства', icon: Smartphone, state: cfgDevices, setState: setCfgDevices, colorCls: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', iconBg: 'bg-amber-100' } },
            ]).map(p => {
              const enabled = cfgEnabled[p.key]
              const Icon = p.icon
              return (
                <div key={p.key} className={`rounded-xl overflow-hidden transition-all duration-200 border
                  ${enabled ? `${p.colorCls.bg} ${p.colorCls.border}` : 'bg-white border-gray-200'}`}>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 transition-all"
                    onClick={() => setCfgEnabled(prev => ({ ...prev, [p.key]: !prev[p.key] }))}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${enabled ? p.colorCls.iconBg : 'bg-gray-100'}`}>
                      <Icon className={`w-4 h-4 ${enabled ? p.colorCls.text : 'text-gray-400'}`} />
                    </div>
                    <span className={`text-sm font-medium flex-1 text-left ${enabled ? 'text-gray-700' : 'text-gray-400'}`}>
                      {p.label}
                    </span>
                    {enabled
                      ? <ToggleRight className={`w-6 h-6 ${p.colorCls.text}`} />
                      : <ToggleLeft className="w-6 h-6 text-gray-300" />}
                  </button>
                  {enabled && (
                    <div className="px-4 pb-4 pt-1">
                      <div className="grid grid-cols-5 gap-3">
                        {(['pricePerUnit', 'min', 'max', 'step', 'default'] as const).map(f => (
                          <div key={f} className="space-y-1">
                            <label className="text-[10px] font-medium text-gray-400">
                              {f === 'pricePerUnit' ? '&#8381; / ед.' : f === 'min' ? 'Мин' : f === 'max' ? 'Макс' : f === 'step' ? 'Шаг' : 'По умолч.'}
                            </label>
                            <input type="number" value={p.state[f]} onChange={e => p.setState(prev => ({ ...prev, [f]: +e.target.value }))}
                              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Configurator preview */}
            <div className="rounded-xl p-4 space-y-3 bg-gray-50 border border-gray-200">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Превью для пользователя
              </p>
              <div className="space-y-3">
                {cfgEnabled.traffic && (
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-400">Трафик</span>
                      <span className="font-medium text-gray-700">{cfgTraffic.default} ГБ</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-gray-200">
                      <div className="h-full rounded-full bg-blue-500" style={{
                        width: `${((cfgTraffic.default - cfgTraffic.min) / (cfgTraffic.max - cfgTraffic.min)) * 100}%`,
                      }} />
                    </div>
                  </div>
                )}
                {cfgEnabled.days && (
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-400">Период</span>
                      <span className="font-medium text-gray-700">{cfgDays.default} дн.</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-gray-200">
                      <div className="h-full rounded-full bg-violet-500" style={{
                        width: `${((cfgDays.default - cfgDays.min) / (cfgDays.max - cfgDays.min)) * 100}%`,
                      }} />
                    </div>
                  </div>
                )}
                {cfgEnabled.devices && (
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-400">Устройства</span>
                      <span className="font-medium text-gray-700">{cfgDevices.default}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-gray-200">
                      <div className="h-full rounded-full bg-amber-500" style={{
                        width: `${((cfgDevices.default - cfgDevices.min) / (cfgDevices.max - cfgDevices.min)) * 100}%`,
                      }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl font-extrabold text-gray-900">
                  {calcCfgPrice().toLocaleString('ru')}
                </span>
                <span className="text-sm text-gray-400">&#8381;</span>
              </div>
            </div>
          </div>
        )}

        {/* Subscription fields */}
        {!isAddon && (
          <>
            {mode === 'simple' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>Дней *</label>
                  <input type="number" value={form.durationDays ?? ''} onChange={e => set('durationDays', +e.target.value)}
                    className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Устройств</label>
                  <input type="number" value={form.deviceLimit ?? 3} onChange={e => set('deviceLimit', +e.target.value)}
                    className={inputCls} />
                </div>
              </div>
            )}

            {(mode === 'variants' || mode === 'configurator') && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>Базовые дни (fallback)</label>
                  <input type="number" value={form.durationDays ?? ''} onChange={e => set('durationDays', +e.target.value)}
                    className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Базовые устройства</label>
                  <input type="number" value={form.deviceLimit ?? 3} onChange={e => set('deviceLimit', +e.target.value)}
                    className={inputCls} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelCls}>Трафик ГБ (пусто = безлимит)</label>
                <input type="number" value={form.trafficGb ?? ''} onChange={e => set('trafficGb', +e.target.value || undefined)}
                  className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Стратегия трафика</label>
                <select value={form.trafficStrategy ?? 'MONTH'} onChange={e => set('trafficStrategy', e.target.value)}
                  className={inputCls}>
                  <option value="MONTH">MONTH -- сброс раз в месяц</option>
                  <option value="NO_RESET">NO_RESET -- не сбрасывается</option>
                  <option value="WEEK">WEEK -- сброс раз в неделю</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>Tag в Remnawave</label>
              <input value={form.remnawaveTag ?? ''} onChange={e => set('remnawaveTag', e.target.value || undefined)}
                placeholder="premium / basic / ..."
                className={`${inputCls} font-mono`} />
            </div>

            {/* Features list */}
            <div className="space-y-2">
              <label className={labelCls}>Преимущества тарифа</label>
              {features.length > 0 && (
                <div className="space-y-1.5">
                  {features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                      <span className="text-sm text-gray-700 flex-1">{f}</span>
                      <button onClick={() => removeFeature(i)}
                        className="text-gray-400 hover:text-red-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input value={featureInput}
                  onChange={e => setFeatureInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                  placeholder="Безлимитный трафик, Высокая скорость..."
                  className={`${inputCls} flex-1`} />
                <button onClick={addFeature}
                  className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}

        {/* Addon fields */}
        {isAddon && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Цена ₽ *</label>
              <input type="number" value={form.priceRub ?? ''} onChange={e => set('priceRub', +e.target.value)}
                className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Цена USDT</label>
              <input type="number" step="0.01" value={form.priceUsdt ?? ''} onChange={e => set('priceUsdt', +e.target.value || undefined)}
                className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Объём трафика ГБ *</label>
              <input type="number" value={(form as any).trafficAddonGb ?? ''} onChange={e => set('trafficAddonGb' as any, +e.target.value)}
                placeholder="100" className={inputCls} />
            </div>
          </div>
        )}

        {/* Options */}
        <div className="flex items-center gap-5 flex-wrap py-1">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={form.isActive ?? true} onChange={e => set('isActive', e.target.checked)}
              className="w-4 h-4 rounded accent-primary-600" />
            <span className="text-sm text-gray-600">Активен</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={form.isVisible ?? true} onChange={e => set('isVisible', e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500" />
            <span className="text-sm text-gray-600">Видимый</span>
          </label>
          {!isAddon && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.isFeatured ?? false} onChange={e => set('isFeatured', e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500" />
              <span className="text-sm text-gray-600">Рекомендованный</span>
            </label>
          )}
          {!isAddon && (
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.isTrial ?? false} onChange={e => set('isTrial', e.target.checked)}
                className="w-4 h-4 rounded accent-violet-500" />
              <span className="text-sm text-gray-600">Тестовый</span>
            </label>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Порядок:</span>
            <input type="number" value={form.sortOrder ?? 0} onChange={e => set('sortOrder', +e.target.value)}
              className="w-16 text-sm text-center border border-gray-200 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <button onClick={save} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button onClick={onCancel}
            className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-600 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors">
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   TARIFF CARD (expandable)
   ================================================================ */

function TariffCard({ tariff, expanded, onToggle, onSave, onDelete }: {
  tariff: Tariff
  expanded: boolean
  onToggle: () => void
  onSave: (t: Tariff) => void
  onDelete: () => void
}) {
  const isAddon = tariff.type === 'TRAFFIC_ADDON'
  const mode = tariff.mode ?? 'simple'
  const modeMeta = MODE_META[mode as keyof typeof MODE_META] ?? MODE_META.simple
  const ModeIcon = modeMeta.icon

  const modeColorMap = {
    simple: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-50 text-blue-600' },
    variants: { bg: 'bg-violet-50', text: 'text-violet-700', badge: 'bg-violet-50 text-violet-600' },
    configurator: { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-600' },
  }
  const modeColors = modeColorMap[mode as keyof typeof modeColorMap] ?? modeColorMap.simple

  const priceRange = () => {
    if (mode === 'variants' && tariff.variants?.length) {
      const prices = tariff.variants.map(v => v.priceRub)
      const min = Math.min(...prices)
      const max = Math.max(...prices)
      return min === max ? `${min.toLocaleString('ru')} ₽` : `${min.toLocaleString('ru')} — ${max.toLocaleString('ru')} ₽`
    }
    return `${Number(tariff.priceRub).toLocaleString('ru')} ₽`
  }

  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-all duration-300
      ${!tariff.isActive ? 'opacity-60' : ''}
      ${expanded ? 'border-primary-200 shadow-sm' : tariff.isFeatured ? 'border-amber-200' : 'border-gray-100'}`}>
      {/* Card header */}
      <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={onToggle}>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
          ${isAddon ? 'bg-amber-50' : modeColors.bg}`}>
          {isAddon
            ? <Zap className="w-5 h-5 text-amber-600" />
            : <ModeIcon className={`w-5 h-5 ${modeColors.text}`} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900">{tariff.name}</span>
            {tariff.isFeatured && (
              <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="currentColor" />
            )}
            {!isAddon && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${modeColors.badge}`}>
                {modeMeta.label}
              </span>
            )}
            {!tariff.isActive && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">Неактивен</span>}
            {!tariff.isVisible && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">Скрыт</span>}
            {tariff.isTrial && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-600">Тестовый</span>}
          </div>
          <div className="text-xs mt-0.5 text-gray-400">
            {isAddon
              ? `+${(tariff as any).trafficAddonGb ?? 0} ГБ`
              : `${tariff.durationDays} дн. · ${tariff.trafficGb ? tariff.trafficGb + ' ГБ' : '∞ трафик'} · ${tariff.deviceLimit} устр.`}
            {tariff.countries && (
              <span className="ml-2">
                {parseCountries(tariff.countries).slice(0, 3).map(c => (
                  <img key={c.code} src={flagUrl(c.code)} alt={c.code} className="w-4 h-3 rounded-sm object-cover inline-block ml-1" />
                ))}
                {parseCountries(tariff.countries).length > 3 && (
                  <span className="text-gray-300 ml-1">+{parseCountries(tariff.countries).length - 3}</span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-lg font-bold whitespace-nowrap text-gray-900">
            {priceRange()}
          </span>
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="transition-transform duration-200" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div className="border-t border-gray-100">
          <TariffForm
            initial={{ ...tariff }}
            onSave={onSave}
            onCancel={onToggle}
          />
        </div>
      )}
    </div>
  )
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

export default function AdminTariffsPage() {
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'SUBSCRIPTION' | 'TRAFFIC_ADDON'>('SUBSCRIPTION')

  const load = useCallback(async () => {
    try {
      const data = await api('GET', '')
      setTariffs(Array.isArray(data) ? data : data.tariffs ?? [])
    } catch { toast.error('Ошибка загрузки тарифов') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const deleteTariff = async (id: string) => {
    if (!confirm('Удалить тариф?')) return
    try {
      await api('DELETE', `/${id}`)
      setTariffs(t => t.filter(x => x.id !== id))
      toast.success('Тариф удалён')
    } catch { toast.error('Ошибка удаления') }
  }

  const filtered = tariffs.filter(t => (t.type ?? 'SUBSCRIPTION') === tab)
  const subs = tariffs.filter(t => (t.type ?? 'SUBSCRIPTION') === 'SUBSCRIPTION')
  const addons = tariffs.filter(t => t.type === 'TRAFFIC_ADDON')

  if (loading) return (
    <div className="max-w-5xl mx-auto space-y-4 p-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
      ))}
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Тарифы</h1>
          <p className="text-sm mt-1 text-gray-400">
            {subs.length} подписок · {addons.length} пакетов трафика
          </p>
        </div>
        <button onClick={() => { setCreating(true); setExpandedId(null) }}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
          <Plus className="w-4 h-4" />
          Создать тариф
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['SUBSCRIPTION', 'TRAFFIC_ADDON'] as const).map(t => {
          const active = tab === t
          const isSub = t === 'SUBSCRIPTION'
          const count = isSub ? subs.length : addons.length
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-200 border
                ${active
                  ? 'bg-white border-primary-200 text-gray-900 shadow-sm'
                  : 'bg-white border-gray-100 text-gray-400 hover:text-gray-600 hover:border-gray-200'
                }`}>
              {isSub ? <Shield className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
              {isSub ? 'Подписки' : 'Доп. трафик'}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
                ${active ? 'bg-primary-50 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Create form */}
      {creating && (
        <TariffForm
          initial={tab === 'SUBSCRIPTION' ? { ...EMPTY_SUB } : { ...EMPTY_ADDON }}
          onSave={saved => {
            setTariffs(t => [...t, saved])
            setCreating(false)
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* Tariff list */}
      <div className="space-y-3">
        {filtered.length === 0 && !creating ? (
          <div className="flex flex-col items-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
              {tab === 'SUBSCRIPTION'
                ? <Shield className="w-8 h-8 text-gray-300" />
                : <Zap className="w-8 h-8 text-gray-300" />}
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">
              {tab === 'SUBSCRIPTION' ? 'Нет подписок' : 'Нет пакетов доп. трафика'}
            </p>
            <p className="text-xs text-gray-400">
              Создайте первый тариф, чтобы начать
            </p>
          </div>
        ) : filtered.map(t => (
          <TariffCard
            key={t.id}
            tariff={t}
            expanded={expandedId === t.id}
            onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
            onSave={saved => {
              setTariffs(list => list.map(x => x.id === saved.id ? saved : x))
              setExpandedId(null)
            }}
            onDelete={() => deleteTariff(t.id)}
          />
        ))}
      </div>

      {/* Bottom create button */}
      {filtered.length > 0 && !creating && (
        <button onClick={() => { setCreating(true); setExpandedId(null) }}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-sm font-semibold border-2 border-dashed border-gray-200 text-gray-400 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50/30 transition-all duration-200">
          <Plus className="w-5 h-5" /> Создать тариф
        </button>
      )}
    </div>
  )
}
