'use client'

import { useState } from 'react'
import { FileBarChart, Download, Calendar, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [dateTo, setDateTo]     = useState(new Date().toISOString().split('T')[0])
  const [generating, setGenerating] = useState<string | null>(null)

  const quickPeriod = (type: string) => {
    const now = new Date()
    switch (type) {
      case 'today':
        setDateFrom(now.toISOString().split('T')[0])
        setDateTo(now.toISOString().split('T')[0])
        break
      case 'month':
        setDateFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
        setDateTo(now.toISOString().split('T')[0])
        break
      case 'year':
        setDateFrom(new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0])
        setDateTo(now.toISOString().split('T')[0])
        break
    }
  }

  const generate = async (format: 'pdf' | 'excel') => {
    setGenerating(format)
    toast.success(`Отчёт ${format.toUpperCase()} будет доступен после полной интеграции`)
    setTimeout(() => setGenerating(null), 1000)
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Отчёты</h1>
      </div>

      <div className="page-content space-y-4">
        {/* Period selector */}
        <div className="card-p">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-primary-600" /> Период</h3>
          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={() => quickPeriod('today')} className="btn-default text-xs">Сегодня</button>
            <button onClick={() => quickPeriod('month')} className="btn-default text-xs">Этот месяц</button>
            <button onClick={() => quickPeriod('year')} className="btn-default text-xs">Этот год</button>
          </div>
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">С</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">По</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input" />
            </div>
          </div>
        </div>

        {/* Report types */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card-p">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-danger-50 flex items-center justify-center"><FileBarChart className="w-5 h-5 text-danger-600" /></div>
              <div><h3 className="text-sm font-medium">PDF отчёт</h3><p className="text-xs text-gray-400">Финансовый отчёт с графиками</p></div>
            </div>
            <p className="text-xs text-gray-400 mb-4">Включает: доходы, расходы, прибыль, топ категории, партнёры, серверы</p>
            <button onClick={() => generate('pdf')} disabled={!!generating} className="btn-primary w-full text-xs">
              {generating === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Скачать PDF
            </button>
          </div>

          <div className="card-p">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-success-50 flex items-center justify-center"><FileBarChart className="w-5 h-5 text-success-600" /></div>
              <div><h3 className="text-sm font-medium">Excel отчёт</h3><p className="text-xs text-gray-400">Таблица с формулами</p></div>
            </div>
            <p className="text-xs text-gray-400 mb-4">Включает: все транзакции, сводка по категориям, платежи пользователей</p>
            <button onClick={() => generate('excel')} disabled={!!generating} className="btn-primary w-full text-xs">
              {generating === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Скачать Excel
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
