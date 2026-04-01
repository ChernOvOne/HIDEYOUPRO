'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Trash2, Save, Loader2, ChevronRight, ChevronDown, FolderPlus,
  MessageSquare, GitBranch, Zap, Clock, Shuffle, CornerDownRight,
  Bell, Globe2, SmilePlus, GripVertical, ArrowLeft, Eye, Pin,
  Hash, Send, Settings2, BarChart3, Edit2, X, Copy, Search,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── API helper ────────────────────────────────────────────────
const api = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin/bot-blocks${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })

// ── Types ─────────────────────────────────────────────────────
interface BotButton { id: string; blockId: string; label: string; type: string; nextBlockId?: string; url?: string; row: number; col: number; clickCount: number }
interface BotBlock {
  id: string; name: string; groupId?: string; type: string
  text?: string; mediaUrl?: string; mediaType?: string; parseMode: string
  pinMessage: boolean; deletePrev: string
  replyKeyboard?: any; removeReplyKb: boolean
  conditionType?: string; conditionValue?: string; nextBlockTrue?: string; nextBlockFalse?: string
  actionType?: string; actionValue?: string; nextBlockId?: string
  inputPrompt?: string; inputVar?: string; inputValidation?: string
  delayMinutes?: number
  splitVariants?: any
  redirectBlockId?: string
  reactionEmoji?: string
  notifyAdminText?: string
  httpMethod?: string; httpUrl?: string; httpHeaders?: any; httpBody?: string; httpSaveVar?: string
  throttleMinutes?: number
  scheduleStart?: string; scheduleEnd?: string; scheduleDays?: number[]; scheduleBlockId?: string
  isDraft: boolean; version: number; publishedAt?: string
  sortOrder: number
  buttons: BotButton[]
  triggers?: any[]
  stats?: any[]
  group?: any
}
interface BotGroup { id: string; name: string; icon?: string; sortOrder: number; _count?: { blocks: number } }

const BLOCK_TYPES = [
  { value: 'MESSAGE',      label: 'Сообщение',       icon: MessageSquare, color: '#06b6d4' },
  { value: 'CONDITION',    label: 'Условие',          icon: GitBranch,     color: '#f59e0b' },
  { value: 'ACTION',       label: 'Действие',         icon: Zap,           color: '#8b5cf6' },
  { value: 'INPUT',        label: 'Ввод данных',      icon: Edit2,         color: '#10b981' },
  { value: 'DELAY',        label: 'Задержка',         icon: Clock,         color: '#64748b' },
  { value: 'SPLIT',        label: 'A/B тест',         icon: Shuffle,       color: '#ec4899' },
  { value: 'REDIRECT',     label: 'Переход',          icon: CornerDownRight,color: '#6366f1' },
  { value: 'NOTIFY_ADMIN', label: 'Уведомить админа', icon: Bell,          color: '#ef4444' },
  { value: 'HTTP',         label: 'HTTP запрос',       icon: Globe2,        color: '#14b8a6' },
  { value: 'REACTION',     label: 'Реакция',          icon: SmilePlus,     color: '#f97316' },
]

const CONDITION_TYPES = [
  { value: 'has_sub',      label: 'Есть подписка' },
  { value: 'no_sub',       label: 'Нет подписки' },
  { value: 'has_remnawave', label: 'Есть в REMNAWAVE' },
  { value: 'expired',      label: 'Подписка истекла' },
  { value: 'traffic_80',   label: 'Трафик > 80%' },
  { value: 'has_tag',      label: 'Есть тег' },
  { value: 'no_tag',       label: 'Нет тега' },
  { value: 'has_var',      label: 'Есть переменная' },
  { value: 'has_email',    label: 'Есть email' },
  { value: 'has_referrer', label: 'Есть реферер' },
]

const ACTION_TYPES = [
  { value: 'bonus_days',    label: 'Бонусные дни',     unit: 'дней' },
  { value: 'balance',       label: 'Пополнить баланс', unit: '₽' },
  { value: 'trial',         label: 'Пробный период',   unit: 'дней' },
  { value: 'add_tag',       label: 'Добавить тег' },
  { value: 'remove_tag',    label: 'Убрать тег' },
  { value: 'set_var',       label: 'Установить переменную' },
]

const DELETE_PREV_OPTIONS = [
  { value: 'none',    label: 'Не удалять' },
  { value: 'buttons', label: 'Убрать кнопки' },
  { value: 'full',    label: 'Удалить полностью' },
]

const BUTTON_TYPES = [
  { value: 'block',   label: '→ Блок' },
  { value: 'url',     label: 'URL' },
  { value: 'webapp',  label: 'WebApp' },
]

const VARIABLES = [
  '{name}', '{email}', '{telegramName}', '{telegramId}', '{balance}', '{bonusDays}',
  '{subStatus}', '{subExpireDate}', '{daysLeft}', '{trafficUsed}', '{trafficLimit}',
  '{deviceCount}', '{deviceLimit}', '{referralCode}', '{referralUrl}',
  '{referralCount}', '{referralPaidCount}', '{appUrl}',
]

const REACTIONS = ['👍', '👎', '❤️', '🔥', '🥰', '👏', '😁', '🤔', '🤯', '😢', '🎉', '🤩', '💯', '⚡', '✅', '❌']

export default function BotConstructorPage() {
  const [groups, setGroups] = useState<BotGroup[]>([])
  const [blocks, setBlocks] = useState<BotBlock[]>([])
  const [allBlocks, setAllBlocks] = useState<{ id: string; name: string; type: string }[]>([])
  const [selectedBlock, setSelectedBlock] = useState<BotBlock | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [showNewBlock, setShowNewBlock] = useState<string | null>(null) // groupId or 'none'
  const [newBlockName, setNewBlockName] = useState('')
  const [newBlockType, setNewBlockType] = useState('MESSAGE')

  // ── Load data ─────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [g, b, bl] = await Promise.all([
        api('/groups'),
        api('/blocks'),
        api('/blocks-list'),
      ])
      setGroups(g)
      setBlocks(b)
      setAllBlocks(bl)
      // Expand all groups by default
      setExpandedGroups(new Set(g.map((gr: BotGroup) => gr.id)))
    } catch (e) { toast.error('Ошибка загрузки') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Refresh selected block after save ─────────────────────
  const refreshSelected = async (id: string) => {
    const b = await api(`/blocks/${id}`)
    setSelectedBlock(b)
    load() // refresh sidebar too
  }

  // ── Group CRUD ────────────────────────────────────────────
  const createGroup = async () => {
    if (!newGroupName.trim()) return
    await api('/groups', { method: 'POST', body: JSON.stringify({ name: newGroupName }) })
    setNewGroupName('')
    setShowNewGroup(false)
    load()
    toast.success('Группа создана')
  }

  const deleteGroup = async (id: string) => {
    if (!confirm('Удалить группу? Блоки станут без группы.')) return
    await api(`/groups/${id}`, { method: 'DELETE' })
    load()
    toast.success('Группа удалена')
  }

  // ── Block CRUD ────────────────────────────────────────────
  const createBlock = async (groupId: string | null) => {
    if (!newBlockName.trim()) return
    const b = await api('/blocks', {
      method: 'POST',
      body: JSON.stringify({ name: newBlockName, type: newBlockType, groupId }),
    })
    setNewBlockName('')
    setShowNewBlock(null)
    setSelectedBlock(b)
    load()
    toast.success('Блок создан')
  }

  const saveBlock = async () => {
    if (!selectedBlock) return
    setSaving(true)
    try {
      const { buttons, triggers, stats, group, ...data } = selectedBlock as any
      await api(`/blocks/${selectedBlock.id}`, { method: 'PUT', body: JSON.stringify(data) })
      toast.success('Сохранено')
      await refreshSelected(selectedBlock.id)
    } catch { toast.error('Ошибка сохранения') }
    setSaving(false)
  }

  const deleteBlock = async (id: string) => {
    if (!confirm('Удалить блок?')) return
    await api(`/blocks/${id}`, { method: 'DELETE' })
    if (selectedBlock?.id === id) setSelectedBlock(null)
    load()
    toast.success('Блок удалён')
  }

  const publishBlock = async (id: string) => {
    await api(`/blocks/${id}/publish`, { method: 'PUT' })
    toast.success('Опубликовано')
    await refreshSelected(id)
  }

  // ── Button CRUD ───────────────────────────────────────────
  const addButton = async () => {
    if (!selectedBlock) return
    await api(`/blocks/${selectedBlock.id}/buttons`, {
      method: 'POST',
      body: JSON.stringify({ label: 'Кнопка', type: 'block', row: (selectedBlock.buttons?.length || 0) }),
    })
    await refreshSelected(selectedBlock.id)
  }

  const updateButton = async (btnId: string, data: Partial<BotButton>) => {
    await api(`/buttons/${btnId}`, { method: 'PUT', body: JSON.stringify(data) })
    await refreshSelected(selectedBlock!.id)
  }

  const deleteButton = async (btnId: string) => {
    await api(`/buttons/${btnId}`, { method: 'DELETE' })
    await refreshSelected(selectedBlock!.id)
  }

  // ── Update selected block field ───────────────────────────
  const upd = (field: string, value: any) => {
    setSelectedBlock(prev => prev ? { ...prev, [field]: value } : null)
  }

  // ── Filter blocks ─────────────────────────────────────────
  const filteredBlocks = search
    ? blocks.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    : blocks

  const blocksByGroup = (groupId: string) => filteredBlocks.filter(b => b.groupId === groupId)
  const ungroupedBlocks = filteredBlocks.filter(b => !b.groupId)

  const getBlockTypeInfo = (type: string) => BLOCK_TYPES.find(t => t.value === type)

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-1)' }} />
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-64px)]" style={{ color: 'var(--text-primary)' }}>
      {/* ═══ SIDEBAR ═══ */}
      <div className="w-80 flex-shrink-0 overflow-y-auto border-r" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-bold mb-2">🤖 Конструктор бота</h2>
          <div className="relative">
            <Search className="absolute left-2 top-2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск блоков..."
              className="glass-input w-full pl-8 text-sm py-1.5"
            />
          </div>
        </div>

        <div className="p-2 space-y-1">
          {groups.map(g => (
            <div key={g.id}>
              <div
                className="flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer hover:opacity-80"
                style={{ background: 'var(--surface-2)' }}
                onClick={() => setExpandedGroups(prev => {
                  const next = new Set(prev)
                  next.has(g.id) ? next.delete(g.id) : next.add(g.id)
                  return next
                })}
              >
                {expandedGroups.has(g.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span className="text-sm">{g.icon || '📁'}</span>
                <span className="text-sm font-medium flex-1">{g.name}</span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{g._count?.blocks || 0}</span>
                <button onClick={e => { e.stopPropagation(); deleteGroup(g.id) }} className="p-0.5 hover:text-red-400 opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              {expandedGroups.has(g.id) && (
                <div className="ml-3 mt-0.5 space-y-0.5">
                  {blocksByGroup(g.id).map(b => {
                    const info = getBlockTypeInfo(b.type)
                    const Icon = info?.icon || MessageSquare
                    return (
                      <div
                        key={b.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${selectedBlock?.id === b.id ? 'ring-1' : ''}`}
                        style={{
                          background: selectedBlock?.id === b.id ? 'rgba(6,182,212,0.1)' : 'transparent',
                          borderColor: selectedBlock?.id === b.id ? 'var(--accent-1)' : 'transparent',
                        }}
                        onClick={() => api(`/blocks/${b.id}`).then(setSelectedBlock)}
                      >
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: info?.color }} />
                        <span className="truncate flex-1">{b.name}</span>
                        {b.isDraft && <span className="text-[10px] px-1 rounded" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>черновик</span>}
                      </div>
                    )
                  })}
                  <button
                    onClick={() => { setShowNewBlock(g.id); setNewBlockType('MESSAGE'); setNewBlockName('') }}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded w-full"
                    style={{ color: 'var(--accent-1)' }}
                  >
                    <Plus className="w-3 h-3" /> Добавить блок
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Ungrouped */}
          {ungroupedBlocks.length > 0 && (
            <div>
              <div className="px-2 py-1 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Без группы</div>
              {ungroupedBlocks.map(b => {
                const info = getBlockTypeInfo(b.type)
                const Icon = info?.icon || MessageSquare
                return (
                  <div key={b.id} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm"
                    style={{ background: selectedBlock?.id === b.id ? 'rgba(6,182,212,0.1)' : 'transparent' }}
                    onClick={() => api(`/blocks/${b.id}`).then(setSelectedBlock)}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: info?.color }} />
                    <span className="truncate">{b.name}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add group button */}
          <div className="pt-2 space-y-1">
            {showNewGroup ? (
              <div className="flex gap-1">
                <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Название группы" className="glass-input flex-1 text-xs py-1" autoFocus onKeyDown={e => e.key === 'Enter' && createGroup()} />
                <button onClick={createGroup} className="btn-primary text-xs px-2 py-1"><Plus className="w-3 h-3" /></button>
                <button onClick={() => setShowNewGroup(false)} className="text-xs px-1"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <button onClick={() => setShowNewGroup(true)} className="flex items-center gap-1 px-2 py-1 text-xs w-full rounded" style={{ color: 'var(--text-tertiary)' }}>
                <FolderPlus className="w-3.5 h-3.5" /> Новая группа
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ New Block Modal ═══ */}
      {showNewBlock !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNewBlock(null)}>
          <div className="p-6 rounded-xl w-[420px]" style={{ background: 'var(--surface-2)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Новый блок</h3>
            <input value={newBlockName} onChange={e => setNewBlockName(e.target.value)} placeholder="Название блока" className="glass-input w-full mb-3" autoFocus />
            <div className="grid grid-cols-2 gap-2 mb-4">
              {BLOCK_TYPES.map(t => {
                const Icon = t.icon
                return (
                  <button key={t.value} onClick={() => setNewBlockType(t.value)}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm border transition-all ${newBlockType === t.value ? 'ring-2' : ''}`}
                    style={{ borderColor: newBlockType === t.value ? t.color : 'var(--border)', background: newBlockType === t.value ? `${t.color}15` : 'var(--surface-1)' }}
                  >
                    <Icon className="w-4 h-4" style={{ color: t.color }} />
                    {t.label}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <button onClick={() => createBlock(showNewBlock === 'none' ? null : showNewBlock)} className="btn-primary flex-1 py-2" disabled={!newBlockName.trim()}>Создать</button>
              <button onClick={() => setShowNewBlock(null)} className="px-4 py-2 rounded-lg" style={{ background: 'var(--surface-1)' }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MAIN EDITOR ═══ */}
      <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--surface-1)' }}>
        {!selectedBlock ? (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
            <MessageSquare className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">Выберите блок для редактирования</p>
            <p className="text-sm mt-1">или создайте новый в группе слева</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedBlock(null)} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex-1">
                <input value={selectedBlock.name} onChange={e => upd('name', e.target.value)} className="glass-input text-lg font-bold w-full" />
              </div>
              <div className="flex gap-2">
                {selectedBlock.isDraft && (
                  <button onClick={() => publishBlock(selectedBlock.id)} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                    <Eye className="w-4 h-4 inline mr-1" /> Опубликовать
                  </button>
                )}
                <button onClick={saveBlock} disabled={saving} className="btn-primary px-4 py-1.5 text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 inline mr-1" />}
                  Сохранить
                </button>
                <button onClick={() => deleteBlock(selectedBlock.id)} className="p-1.5 rounded-lg hover:bg-red-500/10">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>

            {/* Block type + group */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Тип</label>
                <select value={selectedBlock.type} onChange={e => upd('type', e.target.value)} className="glass-input w-full text-sm py-2">
                  {BLOCK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Группа</label>
                <select value={selectedBlock.groupId || ''} onChange={e => upd('groupId', e.target.value || null)} className="glass-input w-full text-sm py-2">
                  <option value="">Без группы</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
                </select>
              </div>
            </div>

            {/* ═══ Type-specific fields ═══ */}

            {/* MESSAGE */}
            {selectedBlock.type === 'MESSAGE' && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Текст сообщения</label>
                    <div className="flex gap-1">
                      {VARIABLES.slice(0, 6).map(v => (
                        <button key={v} onClick={() => upd('text', (selectedBlock.text || '') + v)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--accent-1)' }}>
                          {v}
                        </button>
                      ))}
                      <details className="relative">
                        <summary className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>ещё</summary>
                        <div className="absolute right-0 top-6 z-10 p-2 rounded-lg shadow-xl flex flex-wrap gap-1 w-64" style={{ background: 'var(--surface-2)' }}>
                          {VARIABLES.map(v => (
                            <button key={v} onClick={() => upd('text', (selectedBlock.text || '') + v)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-1)', color: 'var(--accent-1)' }}>
                              {v}
                            </button>
                          ))}
                        </div>
                      </details>
                    </div>
                  </div>
                  <textarea
                    value={selectedBlock.text || ''} onChange={e => upd('text', e.target.value)}
                    rows={6} className="glass-input w-full text-sm resize-y font-mono"
                    placeholder="Текст с *Markdown* и {переменными}"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Parse Mode</label>
                    <select value={selectedBlock.parseMode} onChange={e => upd('parseMode', e.target.value)} className="glass-input w-full text-sm py-2">
                      <option value="Markdown">Markdown</option>
                      <option value="HTML">HTML</option>
                      <option value="MarkdownV2">MarkdownV2</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>При переходе</label>
                    <select value={selectedBlock.deletePrev} onChange={e => upd('deletePrev', e.target.value)} className="glass-input w-full text-sm py-2">
                      {DELETE_PREV_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={selectedBlock.pinMessage} onChange={e => upd('pinMessage', e.target.checked)} className="rounded" />
                    <Pin className="w-3.5 h-3.5" /> Закрепить
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={selectedBlock.isDraft} onChange={e => upd('isDraft', e.target.checked)} className="rounded" />
                    Черновик
                  </label>
                </div>
              </div>
            )}

            {/* CONDITION */}
            {selectedBlock.type === 'CONDITION' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Тип условия</label>
                  <select value={selectedBlock.conditionType || ''} onChange={e => upd('conditionType', e.target.value)} className="glass-input w-full text-sm py-2">
                    <option value="">Выберите...</option>
                    {CONDITION_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                {['has_tag', 'no_tag', 'has_var'].includes(selectedBlock.conditionType || '') && (
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Значение</label>
                    <input value={selectedBlock.conditionValue || ''} onChange={e => upd('conditionValue', e.target.value)} className="glass-input w-full text-sm" placeholder="tag_name или var_name" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: '#10b981' }}>✓ Если да → блок</label>
                    <select value={selectedBlock.nextBlockTrue || ''} onChange={e => upd('nextBlockTrue', e.target.value || null)} className="glass-input w-full text-sm py-2">
                      <option value="">Не выбрано</option>
                      {allBlocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: '#ef4444' }}>✗ Если нет → блок</label>
                    <select value={selectedBlock.nextBlockFalse || ''} onChange={e => upd('nextBlockFalse', e.target.value || null)} className="glass-input w-full text-sm py-2">
                      <option value="">Не выбрано</option>
                      {allBlocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ACTION */}
            {selectedBlock.type === 'ACTION' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Тип действия</label>
                    <select value={selectedBlock.actionType || ''} onChange={e => upd('actionType', e.target.value)} className="glass-input w-full text-sm py-2">
                      <option value="">Выберите...</option>
                      {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Значение</label>
                    <input value={selectedBlock.actionValue || ''} onChange={e => upd('actionValue', e.target.value)} className="glass-input w-full text-sm" placeholder="Количество или значение" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Следующий блок</label>
                  <select value={selectedBlock.nextBlockId || ''} onChange={e => upd('nextBlockId', e.target.value || null)} className="glass-input w-full text-sm py-2">
                    <option value="">Не выбрано</option>
                    {allBlocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* INPUT */}
            {selectedBlock.type === 'INPUT' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Текст запроса</label>
                  <textarea value={selectedBlock.inputPrompt || ''} onChange={e => upd('inputPrompt', e.target.value)} rows={3} className="glass-input w-full text-sm resize-y" placeholder="Введите ваш email:" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Сохранить в переменную</label>
                    <input value={selectedBlock.inputVar || ''} onChange={e => upd('inputVar', e.target.value)} className="glass-input w-full text-sm" placeholder="email" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Валидация</label>
                    <select value={selectedBlock.inputValidation || 'text'} onChange={e => upd('inputValidation', e.target.value)} className="glass-input w-full text-sm py-2">
                      <option value="text">Текст</option>
                      <option value="email">Email</option>
                      <option value="phone">Телефон</option>
                      <option value="number">Число</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Следующий блок (после ввода)</label>
                  <select value={selectedBlock.nextBlockId || ''} onChange={e => upd('nextBlockId', e.target.value || null)} className="glass-input w-full text-sm py-2">
                    <option value="">Не выбрано</option>
                    {allBlocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* DELAY */}
            {selectedBlock.type === 'DELAY' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Задержка (мин)</label>
                    <input type="number" min={1} value={selectedBlock.delayMinutes || 0} onChange={e => upd('delayMinutes', +e.target.value)} className="glass-input w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Следующий блок</label>
                    <select value={selectedBlock.nextBlockId || ''} onChange={e => upd('nextBlockId', e.target.value || null)} className="glass-input w-full text-sm py-2">
                      <option value="">Не выбрано</option>
                      {allBlocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* REDIRECT */}
            {selectedBlock.type === 'REDIRECT' && (
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Перейти к блоку</label>
                <select value={selectedBlock.redirectBlockId || ''} onChange={e => upd('redirectBlockId', e.target.value || null)} className="glass-input w-full text-sm py-2">
                  <option value="">Не выбрано</option>
                  {allBlocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            {/* SPLIT */}
            {selectedBlock.type === 'SPLIT' && (
              <div className="space-y-2">
                <label className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Варианты A/B</label>
                {(selectedBlock.splitVariants as any[] || []).map((v: any, i: number) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select value={v.blockId || ''} onChange={e => {
                      const variants = [...(selectedBlock.splitVariants as any[] || [])]
                      variants[i] = { ...v, blockId: e.target.value }
                      upd('splitVariants', variants)
                    }} className="glass-input flex-1 text-sm py-2">
                      <option value="">Блок...</option>
                      {allBlocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <input type="number" min={1} max={100} value={v.weight || 50} onChange={e => {
                      const variants = [...(selectedBlock.splitVariants as any[] || [])]
                      variants[i] = { ...v, weight: +e.target.value }
                      upd('splitVariants', variants)
                    }} className="glass-input w-20 text-sm" />
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>%</span>
                    <button onClick={() => {
                      const variants = (selectedBlock.splitVariants as any[] || []).filter((_: any, j: number) => j !== i)
                      upd('splitVariants', variants)
                    }} className="p-1 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <button onClick={() => upd('splitVariants', [...(selectedBlock.splitVariants as any[] || []), { blockId: '', weight: 50 }])}
                  className="text-xs px-2 py-1 rounded" style={{ color: 'var(--accent-1)', background: 'rgba(6,182,212,0.06)' }}>
                  + Вариант
                </button>
              </div>
            )}

            {/* NOTIFY_ADMIN */}
            {selectedBlock.type === 'NOTIFY_ADMIN' && (
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Текст уведомления</label>
                <textarea value={selectedBlock.notifyAdminText || ''} onChange={e => upd('notifyAdminText', e.target.value)} rows={3} className="glass-input w-full text-sm resize-y" placeholder="Юзер {name} запросил помощь" />
              </div>
            )}

            {/* HTTP */}
            {selectedBlock.type === 'HTTP' && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-28">
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Метод</label>
                    <select value={selectedBlock.httpMethod || 'GET'} onChange={e => upd('httpMethod', e.target.value)} className="glass-input w-full text-sm py-2">
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>URL</label>
                    <input value={selectedBlock.httpUrl || ''} onChange={e => upd('httpUrl', e.target.value)} className="glass-input w-full text-sm" placeholder="https://api.example.com/webhook" />
                  </div>
                </div>
                {selectedBlock.httpMethod === 'POST' && (
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Body (JSON)</label>
                    <textarea value={selectedBlock.httpBody || ''} onChange={e => upd('httpBody', e.target.value)} rows={3} className="glass-input w-full text-sm resize-y font-mono" />
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Сохранить ответ в переменную</label>
                  <input value={selectedBlock.httpSaveVar || ''} onChange={e => upd('httpSaveVar', e.target.value)} className="glass-input w-full text-sm" placeholder="api_response" />
                </div>
              </div>
            )}

            {/* REACTION */}
            {selectedBlock.type === 'REACTION' && (
              <div className="space-y-3">
                <label className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Реакция</label>
                <div className="flex flex-wrap gap-2">
                  {REACTIONS.map(r => (
                    <button key={r} onClick={() => upd('reactionEmoji', r)}
                      className={`text-xl p-2 rounded-lg transition-all ${selectedBlock.reactionEmoji === r ? 'ring-2 scale-110' : ''}`}
                      style={{ background: selectedBlock.reactionEmoji === r ? 'rgba(6,182,212,0.15)' : 'var(--surface-2)' }}
                    >{r}</button>
                  ))}
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Следующий блок</label>
                  <select value={selectedBlock.nextBlockId || ''} onChange={e => upd('nextBlockId', e.target.value || null)} className="glass-input w-full text-sm py-2">
                    <option value="">Не выбрано</option>
                    {allBlocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* ═══ BUTTONS (for MESSAGE / INPUT blocks) ═══ */}
            {['MESSAGE', 'INPUT'].includes(selectedBlock.type) && (
              <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Кнопки</label>
                  <button onClick={addButton} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--accent-1)', background: 'rgba(6,182,212,0.06)' }}>
                    <Plus className="w-3 h-3 inline mr-1" /> Кнопка
                  </button>
                </div>
                {(selectedBlock.buttons || []).map(btn => (
                  <div key={btn.id} className="flex gap-2 items-center p-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                    <GripVertical className="w-3.5 h-3.5 flex-shrink-0 cursor-grab" style={{ color: 'var(--text-tertiary)' }} />
                    <input value={btn.label} onChange={e => updateButton(btn.id, { label: e.target.value })} placeholder="Текст кнопки" className="glass-input flex-1 text-sm py-1.5" />
                    <select value={btn.type} onChange={e => updateButton(btn.id, { type: e.target.value })} className="glass-input text-sm py-1.5 w-24">
                      {BUTTON_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {btn.type === 'block' ? (
                      <select value={btn.nextBlockId || ''} onChange={e => updateButton(btn.id, { nextBlockId: e.target.value || undefined })} className="glass-input text-sm py-1.5 flex-1">
                        <option value="">→ Блок...</option>
                        {allBlocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    ) : (
                      <input value={btn.url || ''} onChange={e => updateButton(btn.id, { url: e.target.value })} placeholder={btn.type === 'webapp' ? '/dashboard' : 'https://...'} className="glass-input text-sm py-1.5 flex-1" />
                    )}
                    <span className="text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>{btn.clickCount} кл.</span>
                    <button onClick={() => deleteButton(btn.id)} className="p-1 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}

            {/* ═══ ADVANCED SETTINGS ═══ */}
            <details className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <summary className="text-sm font-medium cursor-pointer flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                <Settings2 className="w-3.5 h-3.5" /> Дополнительно
              </summary>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Тротлинг (мин)</label>
                    <input type="number" min={0} value={selectedBlock.throttleMinutes || 0} onChange={e => upd('throttleMinutes', +e.target.value || null)} className="glass-input w-full text-sm" placeholder="0 = выключено" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Fallback блок (вне расписания)</label>
                    <select value={selectedBlock.scheduleBlockId || ''} onChange={e => upd('scheduleBlockId', e.target.value || null)} className="glass-input w-full text-sm py-2">
                      <option value="">Нет</option>
                      {allBlocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Расписание: начало</label>
                    <input type="time" value={selectedBlock.scheduleStart || ''} onChange={e => upd('scheduleStart', e.target.value || null)} className="glass-input w-full text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Расписание: конец</label>
                    <input type="time" value={selectedBlock.scheduleEnd || ''} onChange={e => upd('scheduleEnd', e.target.value || null)} className="glass-input w-full text-sm" />
                  </div>
                </div>
                {/* Stats */}
                {selectedBlock.stats && selectedBlock.stats.length > 0 && (
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-tertiary)' }}>
                      <BarChart3 className="w-3 h-3 inline mr-1" /> Статистика (30 дней)
                    </label>
                    <div className="flex gap-4 text-sm">
                      <div>Показы: <span className="font-bold">{selectedBlock.stats.reduce((s: number, st: any) => s + st.views, 0)}</span></div>
                      <div>Клики: <span className="font-bold">{selectedBlock.stats.reduce((s: number, st: any) => s + st.clicks, 0)}</span></div>
                    </div>
                  </div>
                )}
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Версия: {selectedBlock.version} · Создан: {new Date(selectedBlock.sortOrder || Date.now()).toLocaleDateString('ru')}
                </div>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}
