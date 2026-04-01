'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Save, Plus, Trash2, Globe, Loader2, GripVertical,
  Eye, EyeOff, ChevronDown, ChevronUp, Type, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ── Types ─────────────────────────────────────────────────── */

interface LandingSection {
  id: string
  key: string
  title: string
  content: string
  type: 'hero' | 'features' | 'pricing' | 'faq' | 'reviews' | 'cta' | 'custom'
  sortOrder: number
  isActive: boolean
}

const SECTION_TYPES: { value: string; label: string }[] = [
  { value: 'hero', label: 'Главный баннер' },
  { value: 'features', label: 'Возможности' },
  { value: 'pricing', label: 'Тарифы' },
  { value: 'faq', label: 'FAQ' },
  { value: 'reviews', label: 'Отзывы' },
  { value: 'cta', label: 'Призыв к действию' },
  { value: 'custom', label: 'Произвольный' },
]

const apiFetch = async (path: string, opts?: RequestInit) => {
  const res = await fetch(`/api/admin/landing/sections${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/* ── Component ─────────────────────────────────────────────── */

export default function LandingEditorPage() {
  const [sections, setSections] = useState<LandingSection[]>([])
  const [loading, setLoading]   = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId]   = useState<string | null>(null)

  /* form for new / editing */
  const [formTitle, setFormTitle]     = useState('')
  const [formContent, setFormContent] = useState('')
  const [formType, setFormType]       = useState('custom')
  const [formActive, setFormActive]   = useState(true)
  const [formOrder, setFormOrder]     = useState(0)
  const [showAdd, setShowAdd]         = useState(false)
  const [addSaving, setAddSaving]     = useState(false)

  /* ── Load ──────────────────────────────────────────────── */

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch('')
      const list = data.sections || data || []
      setSections(list.sort((a: LandingSection, b: LandingSection) => a.sortOrder - b.sortOrder))
    } catch {
      toast.error('Ошибка загрузки секций лендинга')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /* ── Add ───────────────────────────────────────────────── */

  const addSection = async () => {
    if (!formTitle.trim()) {
      toast.error('Заголовок обязателен')
      return
    }
    setAddSaving(true)
    try {
      await apiFetch('', {
        method: 'POST',
        body: JSON.stringify({
          title: formTitle.trim(),
          content: formContent,
          type: formType,
          isActive: formActive,
          sortOrder: sections.length,
        }),
      })
      toast.success('Секция добавлена')
      resetForm()
      setShowAdd(false)
      load()
    } catch (err: any) {
      toast.error(err.message || 'Ошибка добавления')
    } finally {
      setAddSaving(false)
    }
  }

  /* ── Edit ──────────────────────────────────────────────── */

  const startEdit = (s: LandingSection) => {
    setEditingId(s.id)
    setFormTitle(s.title)
    setFormContent(s.content)
    setFormType(s.type)
    setFormActive(s.isActive)
    setFormOrder(s.sortOrder)
  }

  const cancelEdit = () => {
    setEditingId(null)
    resetForm()
  }

  const saveEdit = async (id: string) => {
    setSavingId(id)
    try {
      await apiFetch(`/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: formTitle.trim(),
          content: formContent,
          type: formType,
          isActive: formActive,
          sortOrder: formOrder,
        }),
      })
      toast.success('Секция обновлена')
      setEditingId(null)
      resetForm()
      load()
    } catch (err: any) {
      toast.error(err.message || 'Ошибка обновления')
    } finally {
      setSavingId(null)
    }
  }

  /* ── Delete ────────────────────────────────────────────── */

  const deleteSection = async (id: string) => {
    if (!confirm('Удалить эту секцию?')) return
    try {
      await apiFetch(`/${id}`, { method: 'DELETE' })
      toast.success('Секция удалена')
      setSections(prev => prev.filter(s => s.id !== id))
    } catch {
      toast.error('Ошибка удаления')
    }
  }

  /* ── Toggle active ─────────────────────────────────────── */

  const toggleActive = async (s: LandingSection) => {
    try {
      await apiFetch(`/${s.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !s.isActive }),
      })
      setSections(prev => prev.map(sec =>
        sec.id === s.id ? { ...sec, isActive: !sec.isActive } : sec
      ))
    } catch {
      toast.error('Ошибка переключения')
    }
  }

  /* ── Move ──────────────────────────────────────────────── */

  const moveSection = async (id: string, dir: -1 | 1) => {
    const idx = sections.findIndex(s => s.id === id)
    if (idx < 0) return
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= sections.length) return

    const updated = [...sections]
    const tmp = updated[idx].sortOrder
    updated[idx].sortOrder = updated[swapIdx].sortOrder
    updated[swapIdx].sortOrder = tmp

    ;[updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]]
    setSections(updated)

    try {
      await Promise.all([
        apiFetch(`/${updated[idx].id}`, {
          method: 'PUT',
          body: JSON.stringify({ sortOrder: updated[idx].sortOrder }),
        }),
        apiFetch(`/${updated[swapIdx].id}`, {
          method: 'PUT',
          body: JSON.stringify({ sortOrder: updated[swapIdx].sortOrder }),
        }),
      ])
    } catch {
      toast.error('Ошибка сортировки')
      load()
    }
  }

  /* ── Helpers ───────────────────────────────────────────── */

  const resetForm = () => {
    setFormTitle('')
    setFormContent('')
    setFormType('custom')
    setFormActive(true)
    setFormOrder(0)
  }

  const typeBadge = (t: string) => {
    switch (t) {
      case 'hero':     return 'bg-purple-50 text-purple-700 border-purple-100'
      case 'features': return 'bg-blue-50 text-blue-700 border-blue-100'
      case 'pricing':  return 'bg-green-50 text-green-700 border-green-100'
      case 'faq':      return 'bg-amber-50 text-amber-700 border-amber-100'
      case 'reviews':  return 'bg-pink-50 text-pink-700 border-pink-100'
      case 'cta':      return 'bg-orange-50 text-orange-700 border-orange-100'
      default:         return 'bg-gray-50 text-gray-600 border-gray-100'
    }
  }

  /* ── Render ────────────────────────────────────────────── */

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Редактор лендинга</h1>
          <p className="page-subtitle">{sections.length} секций</p>
        </div>
        <button
          onClick={() => { setShowAdd(!showAdd); cancelEdit() }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
        >
          {showAdd ? 'Отмена' : <><Plus className="w-4 h-4" /> Добавить секцию</>}
        </button>
      </div>

      <div className="page-content">
        <div className="max-w-3xl space-y-4">

          {/* ── Add form ──────────────────────────────────── */}
          {showAdd && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Новая секция</h2>
              <SectionForm
                title={formTitle} setTitle={setFormTitle}
                content={formContent} setContent={setFormContent}
                type={formType} setType={setFormType}
                active={formActive} setActive={setFormActive}
                order={null} setOrder={null}
              />
              <button
                onClick={addSection}
                disabled={addSaving}
                className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {addSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Добавить секцию
              </button>
            </div>
          )}

          {/* ── List ──────────────────────────────────────── */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            </div>
          ) : sections.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <Globe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Секций пока нет</h3>
              <p className="text-xs text-gray-400">Добавьте секции для создания лендинга</p>
            </div>
          ) : (
            sections.map((section, idx) => (
              <div key={section.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {editingId === section.id ? (
                  /* ── Edit mode ── */
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-900">Редактирование секции</h3>
                      <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-600">Отмена</button>
                    </div>
                    <SectionForm
                      title={formTitle} setTitle={setFormTitle}
                      content={formContent} setContent={setFormContent}
                      type={formType} setType={setFormType}
                      active={formActive} setActive={setFormActive}
                      order={formOrder} setOrder={setFormOrder}
                    />
                    <button
                      onClick={() => saveEdit(section.id)}
                      disabled={savingId === section.id}
                      className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                      {savingId === section.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Сохранить
                    </button>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      {/* reorder */}
                      <div className="flex flex-col items-center gap-0.5 pt-0.5">
                        <button
                          onClick={() => moveSection(section.id, -1)}
                          disabled={idx === 0}
                          className="p-0.5 rounded text-gray-300 hover:text-gray-500 disabled:opacity-30 transition-colors"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <GripVertical className="w-4 h-4 text-gray-200" />
                        <button
                          onClick={() => moveSection(section.id, 1)}
                          disabled={idx === sections.length - 1}
                          className="p-0.5 rounded text-gray-300 hover:text-gray-500 disabled:opacity-30 transition-colors"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>

                      {/* content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${typeBadge(section.type)}`}>
                            {section.type}
                          </span>
                          {!section.isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-gray-50 text-gray-400 border-gray-100 font-medium">
                              Скрыта
                            </span>
                          )}
                          <span className="text-[10px] text-gray-300 ml-auto">#{section.sortOrder}</span>
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-2">
                          {section.content || 'Нет контента'}
                        </p>
                      </div>

                      {/* actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => toggleActive(section)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            section.isActive ? 'text-primary-600 hover:bg-primary-50' : 'text-gray-300 hover:bg-gray-50'
                          }`}
                          title={section.isActive ? 'Скрыть' : 'Показать'}
                        >
                          {section.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => startEdit(section)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                          title="Редактировать"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteSection(section.id)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}

/* ── Shared form fields ──────────────────────────────────── */

function SectionForm({
  title, setTitle, content, setContent,
  type, setType, active, setActive,
  order, setOrder,
}: {
  title: string; setTitle: (v: string) => void
  content: string; setContent: (v: string) => void
  type: string; setType: (v: string) => void
  active: boolean; setActive: (v: boolean) => void
  order: number | null; setOrder: ((v: number) => void) | null
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Заголовок</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Заголовок секции"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Контент</label>
        <textarea
          rows={5}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Контент секции (HTML или текст)..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white resize-y min-h-[100px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300 font-mono"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Тип</label>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
          >
            {SECTION_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        {order !== null && setOrder && (
          <div className="w-24">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Порядок</label>
            <input
              type="number"
              value={order}
              onChange={e => setOrder(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
            />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between py-1">
        <span className="text-sm text-gray-700">Активна (видна на лендинге)</span>
        <button
          onClick={() => setActive(!active)}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
            active ? 'bg-primary-600' : 'bg-gray-200'
          }`}
        >
          <span
            className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
            style={{ transform: active ? 'translateX(20px)' : 'translateX(0)' }}
          />
        </button>
      </div>
    </div>
  )
}
