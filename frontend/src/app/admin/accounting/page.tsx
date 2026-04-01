'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Edit2, ArrowUpRight, ArrowDownRight, Loader2, Search, Filter, Tag, Download, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin/accounting${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...opts?.headers }, ...opts }).then(r => { if (!r.ok) throw new Error(); return r.json() })

export default function AccountingPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [categories, setCategories]     = useState<any[]>([])
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(true)
  const [type, setType]                 = useState<string>('')
  const [catFilter, setCatFilter]       = useState('')
  const [search, setSearch]             = useState('')
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState({ type: 'INCOME' as string, amount: '', date: new Date().toISOString().split('T')[0], categoryId: '', description: '' })
  const [editId, setEditId]             = useState<string | null>(null)
  const [saving, setSaving]             = useState(false)

  // Category management
  const [showCats, setShowCats]     = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState('#534AB7')

  const COLORS = ['#534AB7', '#1D9E75', '#BA7517', '#E24B4A', '#378ADD', '#D4537E', '#639922']

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (type)      params.set('type', type)
      if (catFilter) params.set('categoryId', catFilter)
      if (search)    params.set('search', search)
      const [t, c] = await Promise.all([
        api(`/transactions?${params}`),
        api('/categories'),
      ])
      setTransactions(t.transactions)
      setTotal(t.total)
      setCategories(c)
    } catch { toast.error('Ошибка загрузки') }
    setLoading(false)
  }, [type, catFilter, search])

  useEffect(() => { load() }, [load])

  const saveTransaction = async () => {
    if (!form.amount) return
    setSaving(true)
    try {
      const data = { ...form, amount: parseFloat(form.amount), categoryId: form.categoryId || null }
      if (editId) {
        await api(`/transactions/${editId}`, { method: 'PUT', body: JSON.stringify(data) })
        toast.success('Обновлено')
      } else {
        await api('/transactions', { method: 'POST', body: JSON.stringify(data) })
        toast.success('Добавлено')
      }
      setShowForm(false)
      setEditId(null)
      setForm({ type: 'INCOME', amount: '', date: new Date().toISOString().split('T')[0], categoryId: '', description: '' })
      load()
    } catch { toast.error('Ошибка') }
    setSaving(false)
  }

  const deleteTransaction = async (id: string) => {
    if (!confirm('Удалить?')) return
    await api(`/transactions/${id}`, { method: 'DELETE' })
    toast.success('Удалено')
    load()
  }

  const editTransaction = (t: any) => {
    setForm({
      type: t.type, amount: String(Number(t.amount)),
      date: new Date(t.date).toISOString().split('T')[0],
      categoryId: t.categoryId || '', description: t.description || '',
    })
    setEditId(t.id)
    setShowForm(true)
  }

  const addCategory = async () => {
    if (!newCatName) return
    await api('/categories', { method: 'POST', body: JSON.stringify({ name: newCatName, color: newCatColor }) })
    setNewCatName('')
    toast.success('Категория создана')
    load()
  }

  const downloadTemplate = async (type: string) => {
    const res = await fetch(`/api/admin/import-excel/templates/${type}`, { credentials: 'include' })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `template_${type}.xlsx`; a.click()
    URL.revokeObjectURL(url)
  }

  const importExcel = async (type: string) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.xlsx,.xls'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const formData = new FormData()
      formData.append('file', file)
      try {
        const res = await fetch(`/api/admin/import-excel/import/${type}`, {
          method: 'POST', credentials: 'include', body: formData,
        })
        const data = await res.json()
        toast.success(`Импортировано: ${data.imported}`)
        if (data.errors?.length) toast.error(`Ошибки: ${data.errors.length}`)
        load()
      } catch { toast.error('Ошибка импорта') }
    }
    input.click()
  }

  // Summary
  const income  = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0)
  const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Бухгалтерия</h1>
          <p className="page-subtitle">{total} транзакций</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadTemplate('transactions')} className="btn-default text-xs">
            <Download className="w-3.5 h-3.5" /> Шаблон Excel
          </button>
          <button onClick={() => importExcel('transactions')} className="btn-default text-xs">
            <Upload className="w-3.5 h-3.5" /> Импорт Excel
          </button>
          <button onClick={() => setShowCats(!showCats)} className="btn-default text-xs">
            <Tag className="w-3.5 h-3.5" /> Категории
          </button>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm({ type: 'INCOME', amount: '', date: new Date().toISOString().split('T')[0], categoryId: '', description: '' }) }} className="btn-primary text-xs">
            <Plus className="w-3.5 h-3.5" /> Добавить
          </button>
        </div>
      </div>

      <div className="page-content space-y-4">
        {/* KPI */}
        <div className="grid grid-cols-3 gap-2">
          <div className="kpi-card">
            <div className="kpi-label">Доход</div>
            <div className="kpi-value text-success-700">{income.toLocaleString('ru')} ₽</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Расход</div>
            <div className="kpi-value text-danger-700">{expense.toLocaleString('ru')} ₽</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Прибыль</div>
            <div className={`kpi-value ${income - expense >= 0 ? 'text-success-700' : 'text-danger-700'}`}>
              {(income - expense).toLocaleString('ru')} ₽
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..." className="input pl-9" />
          </div>
          <select value={type} onChange={e => setType(e.target.value)} className="input w-auto">
            <option value="">Все типы</option>
            <option value="INCOME">Доход</option>
            <option value="EXPENSE">Расход</option>
          </select>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="input w-auto">
            <option value="">Все категории</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Categories panel */}
        {showCats && (
          <div className="card-p">
            <h3 className="text-sm font-medium mb-3">Категории</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {categories.map(c => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-100 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ background: c.color }} />
                  {c.name}
                  <span className="text-xs text-gray-400">{c._count?.transactions || 0}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Новая категория" className="input flex-1" />
              <div className="flex gap-1">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setNewCatColor(c)}
                    className={`w-7 h-7 rounded-lg transition-all ${newCatColor === c ? 'ring-2 ring-offset-1 ring-primary-400 scale-110' : ''}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <button onClick={addCategory} disabled={!newCatName} className="btn-primary text-xs">Создать</button>
            </div>
          </div>
        )}

        {/* Transactions list */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-600" /></div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">Нет транзакций</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === 'INCOME' ? 'bg-success-50' : 'bg-danger-50'}`}>
                    {t.type === 'INCOME' ? <ArrowUpRight className="w-4 h-4 text-success-700" /> : <ArrowDownRight className="w-4 h-4 text-danger-700" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.description || (t.type === 'INCOME' ? 'Доход' : 'Расход')}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {t.category && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <div className="w-2 h-2 rounded-full" style={{ background: t.category.color }} />
                          {t.category.name}
                        </span>
                      )}
                      <span className="text-xs text-gray-300">{new Date(t.date).toLocaleDateString('ru')}</span>
                    </div>
                  </div>
                  <div className={`text-sm font-medium tabular-nums ${t.type === 'INCOME' ? 'text-success-700' : 'text-danger-700'}`}>
                    {t.type === 'INCOME' ? '+' : '-'}{Number(t.amount).toLocaleString('ru')} ₽
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => editTransaction(t)} className="p-1.5 rounded-lg hover:bg-gray-100"><Edit2 className="w-3.5 h-3.5 text-gray-400" /></button>
                    <button onClick={() => deleteTransaction(t.id)} className="p-1.5 rounded-lg hover:bg-danger-50"><Trash2 className="w-3.5 h-3.5 text-gray-400" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Add/Edit Modal ═══ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowForm(false)}>
          <div className="card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">{editId ? 'Редактировать' : 'Новая транзакция'}</h3>

            <div className="flex gap-2 mb-4">
              <button onClick={() => setForm(f => ({ ...f, type: 'INCOME' }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${form.type === 'INCOME' ? 'bg-success-50 text-success-700 ring-1 ring-success-700' : 'bg-gray-50 text-gray-500'}`}>
                Доход
              </button>
              <button onClick={() => setForm(f => ({ ...f, type: 'EXPENSE' }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${form.type === 'EXPENSE' ? 'bg-danger-50 text-danger-700 ring-1 ring-danger-700' : 'bg-gray-50 text-gray-500'}`}>
                Расход
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Сумма *</label>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="input" placeholder="0.00" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Дата</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Категория</label>
                <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} className="input">
                  <option value="">Без категории</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Описание</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input" placeholder="Описание транзакции" />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={saveTransaction} disabled={saving || !form.amount} className="btn-primary flex-1 py-2.5">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editId ? 'Сохранить' : 'Добавить'}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null) }} className="btn-default px-4">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
