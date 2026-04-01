'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Plus, Loader2, ExternalLink, MousePointerClick, Users, ShoppingCart,
  Megaphone, Copy, TrendingUp, Search, Filter, Link2, QrCode, Edit2,
  Trash2, X, DollarSign, Target, BarChart3, Eye, ArrowUpRight, ArrowDownRight,
  Calendar, Globe, ChevronDown, CheckCircle2, PauseCircle, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ── API helper ── */
const api = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin/marketing${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  }).then(r => { if (!r.ok) throw new Error(); return r.json() })

/* ── Types ── */
type Campaign = {
  id: string
  name: string
  platform: string
  budget: number
  spent: number
  cps: number
  subscribersGained: number
  status: 'active' | 'paused' | 'completed' | 'draft'
  utmCode: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  startDate: string
  endDate: string | null
  budgetSource: string
  clicks: number
  leads: number
  conversions: number
  createdAt: string
}

type UtmEntry = {
  code: string
  source: string
  medium: string
  campaign: string
  clicks: number
  leads: number
  conversions: number
  conversionRate: number
}

type Funnel = {
  clicks: number
  leads: number
  subscribers: number
  conversions: number
  leadToConv: number
}

const PLATFORMS = ['Telegram', 'Instagram', 'YouTube', 'VK', 'TikTok', 'Other'] as const
const STATUS_OPTIONS = ['active', 'paused', 'completed', 'draft'] as const

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active:    { label: 'Активна',   color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  paused:    { label: 'Пауза',     color: 'bg-amber-50 text-amber-700',     icon: PauseCircle },
  completed: { label: 'Завершена', color: 'bg-gray-100 text-gray-600',      icon: CheckCircle2 },
  draft:     { label: 'Черновик',  color: 'bg-blue-50 text-blue-600',       icon: Clock },
}

const platformIcon: Record<string, string> = {
  Telegram: '✈️', Instagram: '📸', YouTube: '▶️', VK: '🔵', TikTok: '🎵', Other: '🌐',
}

/* ── Helpers ── */
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const money = (n: number) => Number(n).toLocaleString('ru') + ' ₽'
const pct = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '0%'

/* ══════════════════════════════════════════════════════ */
export default function MarketingPage() {
  /* ── State ── */
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [utmEntries, setUtmEntries] = useState<UtmEntry[]>([])
  const [funnel, setFunnel] = useState<Funnel | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQ, setSearchQ] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Campaign modal
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', platform: 'Telegram' as string, budget: 0, budgetSource: 'account',
    startDate: new Date().toISOString().split('T')[0], endDate: '',
    spent: 0, subscribersGained: 0,
  })

  // UTM generator
  const [showUtmGen, setShowUtmGen] = useState(false)
  const [utmForm, setUtmForm] = useState({ source: '', medium: '', campaign: '' })

  // Active tab
  const [tab, setTab] = useState<'campaigns' | 'utm' | 'stats'>('campaigns')

  /* ── Load ── */
  const load = useCallback(async () => {
    try {
      const [c, f, u] = await Promise.all([
        api('/campaigns'),
        api('/funnel'),
        api('/utm/summary').catch(() => []),
      ])
      setCampaigns(c)
      setFunnel(f)
      setUtmEntries(Array.isArray(u) ? u : [])
    } catch { toast.error('Ошибка загрузки данных') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* ── Computed ── */
  const filtered = useMemo(() => {
    return campaigns.filter(c => {
      if (searchQ && !c.name.toLowerCase().includes(searchQ.toLowerCase())) return false
      if (filterPlatform && c.platform !== filterPlatform) return false
      if (filterStatus && c.status !== filterStatus) return false
      return true
    })
  }, [campaigns, searchQ, filterPlatform, filterStatus])

  const totalBudget = campaigns.reduce((s, c) => s + Number(c.budget), 0)
  const totalSpend  = campaigns.reduce((s, c) => s + Number(c.spent), 0)
  const totalSubs   = campaigns.reduce((s, c) => s + c.subscribersGained, 0)
  const avgCps      = totalSubs > 0 ? totalSpend / totalSubs : 0
  const budgetUsed  = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0

  const bestCampaigns = useMemo(() =>
    [...campaigns].filter(c => c.subscribersGained > 0).sort((a, b) => a.cps - b.cps).slice(0, 5),
  [campaigns])

  /* ── UTM generation ── */
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const generatedUtmLink = useMemo(() => {
    const params = new URLSearchParams()
    if (utmForm.source) params.set('utm_source', utmForm.source)
    if (utmForm.medium) params.set('utm_medium', utmForm.medium)
    if (utmForm.campaign) params.set('utm_campaign', utmForm.campaign)
    const qs = params.toString()
    return qs ? `${baseUrl}/go?${qs}` : ''
  }, [utmForm, baseUrl])

  const campaignUtmLink = useMemo(() => {
    if (!form.name) return ''
    const code = slug(form.name)
    return `${baseUrl}/go/${code}`
  }, [form.name, baseUrl])

  /* ── Actions ── */
  const copyText = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Скопировано в буфер обмена')
  }

  const openCreate = () => {
    setEditId(null)
    setForm({ name: '', platform: 'Telegram', budget: 0, budgetSource: 'account', startDate: new Date().toISOString().split('T')[0], endDate: '', spent: 0, subscribersGained: 0 })
    setShowModal(true)
  }

  const openEdit = (c: Campaign) => {
    setEditId(c.id)
    setForm({
      name: c.name, platform: c.platform, budget: c.budget, budgetSource: c.budgetSource || 'account',
      startDate: c.startDate?.split('T')[0] || '', endDate: c.endDate?.split('T')[0] || '',
      spent: c.spent, subscribersGained: c.subscribersGained,
    })
    setShowModal(true)
  }

  const saveCampaign = async () => {
    if (!form.name) { toast.error('Укажите название'); return }
    try {
      if (editId) {
        await api(`/campaigns/${editId}`, { method: 'PUT', body: JSON.stringify(form) })
        toast.success('Кампания обновлена')
      } else {
        const created = await api('/campaigns', { method: 'POST', body: JSON.stringify(form) })
        toast.success(`Кампания создана. UTM: ${created.utmCode}`)
      }
      setShowModal(false)
      load()
    } catch { toast.error('Ошибка сохранения') }
  }

  const deleteCampaign = async (id: string) => {
    if (!confirm('Удалить кампанию?')) return
    try {
      await api(`/campaigns/${id}`, { method: 'DELETE' })
      toast.success('Кампания удалена')
      load()
    } catch { toast.error('Ошибка удаления') }
  }

  /* ── Loading ── */
  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
    </div>
  )

  return (
    <>
      {/* ══ Header ══ */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Маркетинг</h1>
          <p className="page-subtitle">{campaigns.length} кампаний</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowUtmGen(true)} className="btn-default text-xs flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" /> UTM-генератор
          </button>
          <button onClick={openCreate} className="bg-primary-600 text-white px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-primary-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Кампания
          </button>
        </div>
      </div>

      <div className="page-content space-y-4">
        {/* ══ KPI Stats Cards ══ */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="text-xl font-bold">{money(totalBudget)}</div>
            <div className="text-xs text-gray-400 mt-0.5">Общий бюджет</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-red-500" />
              </div>
            </div>
            <div className="text-xl font-bold">{money(totalSpend)}</div>
            <div className="text-xs text-gray-400 mt-0.5">Потрачено ({budgetUsed.toFixed(0)}%)</div>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${Math.min(budgetUsed, 100)}%` }} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-xl font-bold">{totalSubs.toLocaleString('ru')}</div>
            <div className="text-xs text-gray-400 mt-0.5">Подписчиков</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <Target className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div className="text-xl font-bold">{avgCps.toFixed(1)} ₽</div>
            <div className="text-xs text-gray-400 mt-0.5">Средний CPS</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="text-xl font-bold text-emerald-600">{funnel?.leadToConv || 0}%</div>
            <div className="text-xs text-gray-400 mt-0.5">Конверсия (лид-оплата)</div>
          </div>
        </div>

        {/* ══ Conversion Funnel ══ */}
        {funnel && (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold mb-4">Воронка конверсии</h3>
            <div className="flex items-center gap-3">
              {[
                { value: funnel.clicks, label: 'Кликов', icon: MousePointerClick, color: 'text-blue-600', bg: 'bg-blue-50' },
                { value: funnel.leads, label: 'Лидов', icon: Users, color: 'text-amber-600', bg: 'bg-amber-50' },
                { value: funnel.subscribers, label: 'Подписчиков', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
                { value: funnel.conversions, label: 'Оплат', icon: ShoppingCart, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-center gap-3 flex-1">
                  <div className="flex-1 text-center">
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${step.bg} mb-2`}>
                      <step.icon className={`w-5 h-5 ${step.color}`} />
                    </div>
                    <div className="text-2xl font-bold">{(step.value ?? 0).toLocaleString('ru')}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{step.label}</div>
                    {i > 0 && arr[i - 1].value > 0 && (
                      <div className="text-xs text-gray-300 mt-1">{pct(step.value, arr[i - 1].value)}</div>
                    )}
                  </div>
                  {i < arr.length - 1 && (
                    <div className="text-gray-200 text-lg font-light">&rarr;</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ Tabs ══ */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {[
            { key: 'campaigns' as const, label: 'Кампании', icon: Megaphone },
            { key: 'utm' as const, label: 'UTM-аналитика', icon: Link2 },
            { key: 'stats' as const, label: 'Статистика', icon: BarChart3 },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════ TAB: Campaigns ═══════════ */}
        {tab === 'campaigns' && (
          <>
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Поиск по названию..." className="input pl-9 w-full" />
              </div>
              <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="input w-auto">
                <option value="">Все площадки</option>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input w-auto">
                <option value="">Все статусы</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusConfig[s].label}</option>)}
              </select>
            </div>

            {/* Campaign Table */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Кампания</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Площадка</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Бюджет</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Потрачено</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">CPS</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Подписчики</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Статус</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell">UTM</th>
                      <th className="px-4 py-3 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">Нет кампаний</td></tr>
                    ) : filtered.map(c => {
                      const sc = statusConfig[c.status] || statusConfig.draft
                      const StatusIcon = sc.icon
                      return (
                        <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-sm">
                                {platformIcon[c.platform] || '🌐'}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium truncate max-w-[200px]">{c.name}</div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {c.startDate && new Date(c.startDate).toLocaleDateString('ru')}
                                  {c.endDate && ` — ${new Date(c.endDate).toLocaleDateString('ru')}`}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-gray-600">{c.platform}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-right tabular-nums">{money(c.budget)}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">{money(c.spent)}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-right tabular-nums">
                            {c.subscribersGained > 0 ? `${c.cps.toFixed(0)} ₽` : '—'}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell text-right tabular-nums">{c.subscribersGained}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                              <StatusIcon className="w-3 h-3" /> {sc.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden xl:table-cell">
                            {c.utmCode && (
                              <button onClick={() => copyText(`${baseUrl}/go/${c.utmCode}`)}
                                className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
                                <Copy className="w-3 h-3" /> {c.utmCode}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deleteCampaign(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ═══════════ TAB: UTM Analytics ═══════════ */}
        {tab === 'utm' && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold">UTM-коды</h3>
              <span className="text-xs text-gray-400">{utmEntries.length} записей</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">UTM Code</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Source</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Medium</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Campaign</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Клики</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Лиды</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Конверсии</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">CR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {utmEntries.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-gray-400 text-sm">Нет UTM-данных</td></tr>
                  ) : utmEntries.map(u => (
                    <tr key={u.code} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => copyText(`${baseUrl}/go/${u.code}`)}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:underline font-mono">
                          <Copy className="w-3 h-3" /> {u.code}
                        </button>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-600">{u.source || '—'}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-600">{u.medium || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-600">{u.campaign || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{u.clicks.toLocaleString('ru')}</td>
                      <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">{u.leads.toLocaleString('ru')}</td>
                      <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">{u.conversions.toLocaleString('ru')}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-medium ${u.conversionRate > 5 ? 'text-emerald-600' : u.conversionRate > 2 ? 'text-amber-600' : 'text-gray-500'}`}>
                          {u.conversionRate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════ TAB: Stats ═══════════ */}
        {tab === 'stats' && (
          <div className="space-y-4">
            {/* Budget overview */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold mb-4">Бюджет: расход vs план</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Общий бюджет</div>
                  <div className="text-2xl font-bold">{money(totalBudget)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Потрачено</div>
                  <div className="text-2xl font-bold text-red-500">{money(totalSpend)}</div>
                </div>
              </div>
              <div className="mt-4 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary-600 rounded-full transition-all" style={{ width: `${Math.min(budgetUsed, 100)}%` }} />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-gray-400">{budgetUsed.toFixed(1)}% использовано</span>
                <span className="text-xs text-gray-400">Остаток: {money(Math.max(0, totalBudget - totalSpend))}</span>
              </div>
            </div>

            {/* Best performing */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold mb-4">Лучшие кампании (по CPS)</h3>
              {bestCampaigns.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">Нет данных</div>
              ) : (
                <div className="space-y-3">
                  {bestCampaigns.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.platform} &middot; {c.subscribersGained} подп.</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-600">{c.cps.toFixed(0)} ₽</div>
                        <div className="text-xs text-gray-400">CPS</div>
                      </div>
                      <div className="text-right hidden md:block">
                        <div className="text-sm tabular-nums">{money(c.spent)}</div>
                        <div className="text-xs text-gray-400">потрачено</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══════════ Campaign Create/Edit Modal ══════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl border border-gray-100 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold">{editId ? 'Редактировать кампанию' : 'Новая кампания'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Название *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Рекламная кампания #1" className="input w-full" autoFocus />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Площадка</label>
                <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="input w-full">
                  {PLATFORMS.map(p => <option key={p} value={p}>{platformIcon[p]} {p}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Бюджет ₽</label>
                  <input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: +e.target.value }))}
                    placeholder="10000" className="input w-full" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Источник бюджета</label>
                  <select value={form.budgetSource} onChange={e => setForm(f => ({ ...f, budgetSource: e.target.value }))} className="input w-full">
                    <option value="account">Счёт компании</option>
                    <option value="card">Карта</option>
                    <option value="crypto">Крипто</option>
                    <option value="other">Другое</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Дата начала</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className="input w-full" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Дата окончания</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className="input w-full" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Потрачено ₽</label>
                  <input type="number" value={form.spent} onChange={e => setForm(f => ({ ...f, spent: +e.target.value }))}
                    placeholder="0" className="input w-full" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Подписчиков</label>
                  <input type="number" value={form.subscribersGained} onChange={e => setForm(f => ({ ...f, subscribersGained: +e.target.value }))}
                    placeholder="0" className="input w-full" />
                </div>
              </div>

              {/* Auto-generated UTM link */}
              {form.name && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">UTM-ссылка (авто)</label>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-gray-600 bg-white border border-gray-200 rounded px-2 py-1.5 flex-1 truncate">
                      {campaignUtmLink}
                    </code>
                    <button onClick={() => copyText(campaignUtmLink)}
                      className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={saveCampaign} disabled={!form.name}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex-1 hover:bg-primary-700 transition-colors disabled:opacity-40">
                {editId ? 'Сохранить' : 'Создать'}
              </button>
              <button onClick={() => setShowModal(false)} className="btn-default px-4 py-2">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ UTM Link Generator Modal ══════════ */}
      {showUtmGen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowUtmGen(false)}>
          <div className="bg-white rounded-xl border border-gray-100 p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary-600" /> UTM-генератор
              </h3>
              <button onClick={() => setShowUtmGen(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Base URL</label>
                <input value={baseUrl} readOnly className="input w-full bg-gray-50 text-gray-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">utm_source</label>
                <input value={utmForm.source} onChange={e => setUtmForm(f => ({ ...f, source: e.target.value }))}
                  placeholder="telegram, instagram, youtube" className="input w-full" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">utm_medium</label>
                <input value={utmForm.medium} onChange={e => setUtmForm(f => ({ ...f, medium: e.target.value }))}
                  placeholder="cpc, post, story, banner" className="input w-full" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">utm_campaign</label>
                <input value={utmForm.campaign} onChange={e => setUtmForm(f => ({ ...f, campaign: e.target.value }))}
                  placeholder="spring_sale_2026" className="input w-full" />
              </div>

              {/* Generated link preview */}
              {generatedUtmLink && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <label className="text-xs font-medium text-gray-600 block">Сгенерированная ссылка</label>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-gray-700 bg-white border border-gray-200 rounded px-2 py-1.5 flex-1 break-all">
                      {generatedUtmLink}
                    </code>
                    <button onClick={() => copyText(generatedUtmLink)}
                      className="bg-primary-600 text-white p-2 rounded-lg hover:bg-primary-700 transition-colors flex-shrink-0">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* QR Code section */}
              {generatedUtmLink && (
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <label className="text-xs font-medium text-gray-600 block mb-2">QR-код</label>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(generatedUtmLink)}`}
                    alt="QR Code"
                    className="w-32 h-32 mx-auto rounded-lg border border-gray-200"
                  />
                  <p className="text-xs text-gray-400 mt-2">Скачайте или сделайте скриншот</p>
                </div>
              )}
            </div>

            <div className="mt-5">
              <button onClick={() => setShowUtmGen(false)} className="btn-default w-full py-2">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
