'use client'

import { useState } from 'react'
import { GitCompare, ArrowUpRight, ArrowDownRight, Loader2, Equal } from 'lucide-react'
import toast from 'react-hot-toast'

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin/reports${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...opts?.headers }, ...opts }).then(r => { if (!r.ok) throw new Error(); return r.json() })

export default function ComparePage() {
  const [periodA, setPeriodA] = useState({ from: '', to: '' })
  const [periodB, setPeriodB] = useState({ from: '', to: '' })
  const [dataA, setDataA]     = useState<any>(null)
  const [dataB, setDataB]     = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const compare = async () => {
    if (!periodA.from || !periodA.to || !periodB.from || !periodB.to) {
      toast.error('Выберите оба периода')
      return
    }
    setLoading(true)
    try {
      const [a, b] = await Promise.all([
        api('/data', { method: 'POST', body: JSON.stringify({ dateFrom: periodA.from, dateTo: periodA.to }) }),
        api('/data', { method: 'POST', body: JSON.stringify({ dateFrom: periodB.from, dateTo: periodB.to }) }),
      ])
      setDataA(a)
      setDataB(b)
    } catch { toast.error('Ошибка') }
    setLoading(false)
  }

  const diff = (a: number, b: number) => {
    if (a === 0 && b === 0) return { pct: 0, dir: 'eq' }
    if (a === 0) return { pct: 100, dir: 'up' }
    const pct = Math.round(((b - a) / a) * 100)
    return { pct: Math.abs(pct), dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'eq' }
  }

  const DiffBadge = ({ a, b, invert }: { a: number; b: number; invert?: boolean }) => {
    const d = diff(a, b)
    const isGood = invert ? d.dir === 'down' : d.dir === 'up'
    if (d.dir === 'eq') return <span className="badge-gray"><Equal className="w-3 h-3" /> 0%</span>
    return (
      <span className={isGood ? 'badge-success' : 'badge-danger'}>
        {d.dir === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {d.pct}%
      </span>
    )
  }

  const Row = ({ label, valA, valB, suffix, invert }: { label: string; valA: number; valB: number; suffix?: string; invert?: boolean }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-50">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-4">
        <span className="text-sm tabular-nums w-24 text-right">{valA.toLocaleString('ru')}{suffix}</span>
        <span className="text-sm tabular-nums w-24 text-right font-medium">{valB.toLocaleString('ru')}{suffix}</span>
        <div className="w-20"><DiffBadge a={valA} b={valB} invert={invert} /></div>
      </div>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Сравнение периодов</h1>
      </div>

      <div className="page-content space-y-4">
        {/* Period selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card-p">
            <h3 className="text-sm font-medium mb-3 text-primary-600">Период A</h3>
            <div className="flex gap-2">
              <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">С</label><input type="date" value={periodA.from} onChange={e => setPeriodA(p => ({ ...p, from: e.target.value }))} className="input" /></div>
              <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">По</label><input type="date" value={periodA.to} onChange={e => setPeriodA(p => ({ ...p, to: e.target.value }))} className="input" /></div>
            </div>
          </div>
          <div className="card-p">
            <h3 className="text-sm font-medium mb-3 text-warn-700">Период B</h3>
            <div className="flex gap-2">
              <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">С</label><input type="date" value={periodB.from} onChange={e => setPeriodB(p => ({ ...p, from: e.target.value }))} className="input" /></div>
              <div className="flex-1"><label className="text-xs text-gray-500 mb-1 block">По</label><input type="date" value={periodB.to} onChange={e => setPeriodB(p => ({ ...p, to: e.target.value }))} className="input" /></div>
            </div>
          </div>
        </div>

        <button onClick={compare} disabled={loading} className="btn-primary">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
          Сравнить
        </button>

        {/* Results */}
        {dataA && dataB && (
          <div className="card-p">
            <div className="flex items-center gap-4 mb-4 pb-3 border-b border-gray-100">
              <span className="text-sm font-medium flex-1">Показатель</span>
              <span className="text-sm text-primary-600 w-24 text-right">Период A</span>
              <span className="text-sm text-warn-700 w-24 text-right">Период B</span>
              <span className="text-sm text-gray-400 w-20">Разница</span>
            </div>
            <Row label="Доход" valA={dataA.summary.income} valB={dataB.summary.income} suffix=" ₽" />
            <Row label="Расход" valA={dataA.summary.expense} valB={dataB.summary.expense} suffix=" ₽" invert />
            <Row label="Прибыль" valA={dataA.summary.profit} valB={dataB.summary.profit} suffix=" ₽" />
            <Row label="Выручка (оплаты)" valA={dataA.summary.revenue} valB={dataB.summary.revenue} suffix=" ₽" />
            <Row label="Новых юзеров" valA={dataA.summary.newUsers} valB={dataB.summary.newUsers} />
            <Row label="Оплат" valA={dataA.summary.paidPayments} valB={dataB.summary.paidPayments} />
            <Row label="Транзакций (доход)" valA={dataA.summary.incomeCount} valB={dataB.summary.incomeCount} />
            <Row label="Транзакций (расход)" valA={dataA.summary.expenseCount} valB={dataB.summary.expenseCount} invert />
          </div>
        )}
      </div>
    </>
  )
}
