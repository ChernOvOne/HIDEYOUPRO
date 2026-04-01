'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Loader2, ExternalLink, MousePointerClick, Users, ShoppingCart, Megaphone, Copy, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin/marketing${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...opts?.headers }, ...opts }).then(r => { if (!r.ok) throw new Error(); return r.json() })

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [funnel, setFunnel]       = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], channelName: '', channelUrl: '', format: '', amount: 0, subscribersGained: 0, notes: '', budgetSource: 'account' })

  const load = useCallback(async () => {
    try {
      const [c, f] = await Promise.all([api('/campaigns'), api('/funnel')])
      setCampaigns(c)
      setFunnel(f)
    } catch { toast.error('Ошибка') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createCampaign = async () => {
    if (!form.channelName) return
    const created = await api('/campaigns', { method: 'POST', body: JSON.stringify(form) })
    setShowForm(false)
    setForm({ date: new Date().toISOString().split('T')[0], channelName: '', channelUrl: '', format: '', amount: 0, subscribersGained: 0, notes: '', budgetSource: 'account' })
    toast.success(`Кампания создана. UTM: ${created.utmCode}`)
    load()
  }

  const copyUtm = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/go/${code}`)
    toast.success('UTM-ссылка скопирована')
  }

  const totalSpend = campaigns.reduce((s, c) => s + Number(c.amount), 0)
  const totalSubs  = campaigns.reduce((s, c) => s + c.subscribersGained, 0)
  const avgCps     = totalSubs > 0 ? totalSpend / totalSubs : 0

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Маркетинг</h1>
          <p className="page-subtitle">{campaigns.length} кампаний</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs"><Plus className="w-3.5 h-3.5" /> Кампания</button>
      </div>

      <div className="page-content space-y-4">
        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="kpi-card">
            <div className="kpi-label">Потрачено</div>
            <div className="kpi-value">{totalSpend.toLocaleString('ru')} ₽</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Подписчиков</div>
            <div className="kpi-value">{totalSubs}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">CPS (стоимость подписчика)</div>
            <div className="kpi-value">{avgCps.toFixed(1)} ₽</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Конверсия (лид→оплата)</div>
            <div className="kpi-value text-success-700">{funnel?.leadToConv || 0}%</div>
          </div>
        </div>

        {/* Funnel */}
        {funnel && (
          <div className="card-p">
            <h3 className="text-sm font-medium mb-3">Воронка</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-primary-600">{funnel.clicks}</div>
                <div className="text-xs text-gray-400 flex items-center justify-center gap-1"><MousePointerClick className="w-3 h-3" /> Кликов</div>
              </div>
              <div className="text-gray-300">→</div>
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-warn-700">{funnel.leads}</div>
                <div className="text-xs text-gray-400 flex items-center justify-center gap-1"><Users className="w-3 h-3" /> Лидов</div>
              </div>
              <div className="text-gray-300">→</div>
              <div className="flex-1 text-center">
                <div className="text-2xl font-bold text-success-700">{funnel.conversions}</div>
                <div className="text-xs text-gray-400 flex items-center justify-center gap-1"><ShoppingCart className="w-3 h-3" /> Оплат</div>
              </div>
            </div>
          </div>
        )}

        {/* Campaigns */}
        <div className="card overflow-hidden">
          <div className="divide-y divide-gray-50">
            {campaigns.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                  <Megaphone className="w-4 h-4 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.channelName}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span>{new Date(c.date).toLocaleDateString('ru')}</span>
                    {c.format && <span>· {c.format}</span>}
                    {c.utmCode && (
                      <button onClick={() => copyUtm(c.utmCode)} className="flex items-center gap-0.5 text-primary-600 hover:underline">
                        <Copy className="w-3 h-3" />{c.utmCode}
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium tabular-nums">{Number(c.amount).toLocaleString('ru')} ₽</div>
                  <div className="text-xs text-gray-400">+{c.subscribersGained} подп. · CPS {c.cps.toFixed(0)}₽</div>
                </div>
                <div className="text-xs text-gray-400 hidden md:block">
                  <div>{c.clicks} кл.</div>
                  <div>{c.leads} лид.</div>
                </div>
              </div>
            ))}
            {campaigns.length === 0 && (
              <div className="py-12 text-center text-gray-400 text-sm">Нет кампаний</div>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowForm(false)}>
          <div className="card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">Новая кампания</h3>
            <div className="space-y-3">
              <input value={form.channelName} onChange={e => setForm(f => ({ ...f, channelName: e.target.value }))} placeholder="Канал/площадка *" className="input" autoFocus />
              <input value={form.channelUrl} onChange={e => setForm(f => ({ ...f, channelUrl: e.target.value }))} placeholder="URL канала" className="input" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input" />
                <input value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))} placeholder="Формат (пост, сторис)" className="input" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))} placeholder="Бюджет ₽" className="input" />
                <input type="number" value={form.subscribersGained} onChange={e => setForm(f => ({ ...f, subscribersGained: +e.target.value }))} placeholder="Подписчиков" className="input" />
              </div>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Заметки" className="input" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={createCampaign} disabled={!form.channelName} className="btn-primary flex-1">Создать</button>
              <button onClick={() => setShowForm(false)} className="btn-default px-4">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
