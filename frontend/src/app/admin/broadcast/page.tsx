'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Send, Mail, MessageCircle, Users, Clock, Plus, Trash2,
  Eye, Calendar, ChevronDown, AlertCircle, X, Loader2,
  Image as ImageIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ── Types ─────────────────────────────────────── */

type Channel = 'telegram' | 'email' | 'both'
type Audience = 'all' | 'active_subscription' | 'no_subscription' | 'expiring_subscription' | 'email_only' | 'telegram_only'
type BroadcastStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'COMPLETED' | 'CANCELLED'

interface InlineButton { label: string; url: string }

interface Broadcast {
  id: string
  createdAt: string
  channel: Channel
  audience: Audience
  recipientCount: number
  sentCount: number
  errorCount: number
  status: BroadcastStatus
  telegramText?: string
  telegramButtons?: InlineButton[]
  telegramMedia?: string
  emailSubject?: string
  emailBody?: string
  emailCtaText?: string
  emailCtaUrl?: string
  scheduledAt?: string
}

/* ── Constants ─────────────────────────────────── */

const API = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin/broadcast${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  }).then(async r => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`)
    return r.json()
  })

const AUDIENCE_OPTIONS: { value: Audience; label: string; desc: string }[] = [
  { value: 'all',                   label: 'Все пользователи',          desc: 'Все зарегистрированные пользователи' },
  { value: 'active_subscription',   label: 'С активной подпиской',      desc: 'Пользователи с действующей подпиской' },
  { value: 'no_subscription',       label: 'Без подписки',              desc: 'Пользователи без активной подписки' },
  { value: 'expiring_subscription', label: 'Подписка истекает (1-7 дн)',desc: 'Подписка заканчивается в ближайшую неделю' },
  { value: 'email_only',            label: 'Только с email',            desc: 'Пользователи с указанным email' },
  { value: 'telegram_only',         label: 'Только с Telegram',         desc: 'Пользователи с привязанным Telegram' },
]

const STATUS_CFG: Record<BroadcastStatus, { label: string; cls: string }> = {
  DRAFT:     { label: 'Черновик',      cls: 'bg-gray-50 text-gray-600 border-gray-200' },
  SCHEDULED: { label: 'Запланировано', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  SENDING:   { label: 'Отправляется',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  COMPLETED: { label: 'Завершено',     cls: 'bg-green-50 text-green-700 border-green-200' },
  CANCELLED: { label: 'Отменено',      cls: 'bg-red-50 text-red-600 border-red-200' },
}

const CHANNEL_LABELS: Record<Channel, string> = { telegram: 'Telegram', email: 'Email', both: 'Оба' }
const AUDIENCE_SHORT: Record<Audience, string> = {
  all: 'Все', active_subscription: 'С подпиской', no_subscription: 'Без подписки',
  expiring_subscription: 'Истекающие', email_only: 'Email', telegram_only: 'Telegram',
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
}

/* ── Component ─────────────────────────────────── */

export default function BroadcastPage() {
  const [tab, setTab] = useState<'create' | 'history'>('create')

  // Create form
  const [channel, setChannel]   = useState<Channel>('telegram')
  const [audience, setAudience] = useState<Audience>('all')
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)

  const [tgText, setTgText]             = useState('')
  const [tgButtons, setTgButtons]       = useState<InlineButton[]>([])
  const [tgMedia, setTgMedia]           = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody]       = useState('')
  const [emailCtaText, setEmailCtaText] = useState('')
  const [emailCtaUrl, setEmailCtaUrl]   = useState('')

  const [showPreview, setShowPreview]       = useState(false)
  const [showScheduler, setShowScheduler]   = useState(false)
  const [scheduledAt, setScheduledAt]       = useState('')
  const [confirmSend, setConfirmSend]       = useState(false)
  const [sending, setSending]               = useState(false)

  // History
  const [history, setHistory]           = useState<Broadcast[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [expandedId, setExpandedId]     = useState<string | null>(null)

  /* ── Fetch recipient count ── */

  const fetchCount = useCallback(async (aud: Audience) => {
    setLoadingCount(true)
    try {
      const data = await API(`/preview?audience=${aud}`)
      setRecipientCount(data.count ?? data.recipientCount ?? 0)
    } catch { setRecipientCount(null) }
    setLoadingCount(false)
  }, [])

  useEffect(() => { fetchCount(audience) }, [audience, fetchCount])

  /* ── Fetch history ── */

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const data = await API('')
      setHistory(Array.isArray(data) ? data : data.broadcasts ?? [])
    } catch { /* ignore */ }
    setLoadingHistory(false)
  }, [])

  useEffect(() => { if (tab === 'history') loadHistory() }, [tab, loadHistory])

  /* ── Actions ── */

  const buildPayload = (extra: Record<string, unknown> = {}) => ({
    channel, audience,
    ...(channel !== 'email' && {
      telegramText: tgText,
      telegramButtons: tgButtons.filter(b => b.label && b.url),
      ...(tgMedia && { telegramMedia: tgMedia }),
    }),
    ...(channel !== 'telegram' && {
      emailSubject, emailBody,
      ...(emailCtaText && { emailCtaText }),
      ...(emailCtaUrl && { emailCtaUrl }),
    }),
    ...extra,
  })

  const sendNow = async () => {
    setSending(true)
    try {
      const created = await API('', { method: 'POST', body: JSON.stringify(buildPayload()) })
      await API(`/${created.id}/send`, { method: 'POST' })
      toast.success('Рассылка отправлена')
      setConfirmSend(false)
      resetForm()
      setTab('history')
      loadHistory()
    } catch (e: any) { toast.error(e.message || 'Ошибка отправки') }
    setSending(false)
  }

  const schedule = async () => {
    if (!scheduledAt) return
    setSending(true)
    try {
      await API('', { method: 'POST', body: JSON.stringify(buildPayload({ scheduledAt })) })
      toast.success('Рассылка запланирована')
      setShowScheduler(false)
      resetForm()
      setTab('history')
      loadHistory()
    } catch (e: any) { toast.error(e.message || 'Ошибка') }
    setSending(false)
  }

  const cancelBroadcast = async (id: string) => {
    try { await API(`/${id}/cancel`, { method: 'POST' }); toast.success('Отменено'); loadHistory() }
    catch (e: any) { toast.error(e.message) }
  }

  const deleteBroadcast = async (id: string) => {
    if (!confirm('Удалить рассылку?')) return
    try { await API(`/${id}`, { method: 'DELETE' }); toast.success('Удалено'); loadHistory() }
    catch (e: any) { toast.error(e.message) }
  }

  const resetForm = () => {
    setChannel('telegram'); setAudience('all')
    setTgText(''); setTgButtons([]); setTgMedia('')
    setEmailSubject(''); setEmailBody(''); setEmailCtaText(''); setEmailCtaUrl('')
    setScheduledAt('')
  }

  /* ── TG buttons ── */

  const addTgButton = () => { if (tgButtons.length < 5) setTgButtons([...tgButtons, { label: '', url: '' }]) }
  const updateTgButton = (i: number, field: keyof InlineButton, val: string) => {
    const copy = [...tgButtons]; copy[i] = { ...copy[i], [field]: val }; setTgButtons(copy)
  }
  const removeTgButton = (i: number) => setTgButtons(tgButtons.filter((_, idx) => idx !== i))

  /* ── Validation ── */

  const canSend =
    (channel !== 'email'    ? tgText.trim().length > 0 : true) &&
    (channel !== 'telegram' ? emailSubject.trim().length > 0 && emailBody.trim().length > 0 : true)

  /* ── Render ── */

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Рассылка</h1>
          <p className="page-subtitle">Массовые сообщения пользователям</p>
        </div>
        <button onClick={() => { resetForm(); setTab('create') }}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5">
          <Send className="w-3.5 h-3.5" /> Создать рассылку
        </button>
      </div>

      <div className="page-content">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-gray-100 rounded-lg w-fit">
          {([['create', 'Создать'], ['history', 'История']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ═══ CREATE TAB ═══ */}
        {tab === 'create' && (
          <div className="space-y-5 max-w-3xl">
            {/* Step 1: Channel */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <StepHeader num={1} title="Канал" />
              <div className="flex gap-2 mt-3">
                {([['telegram', 'Telegram', MessageCircle], ['email', 'Email', Mail], ['both', 'Оба', Send]] as const).map(([ch, label, Icon]) => (
                  <button key={ch} onClick={() => setChannel(ch)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                      channel === ch ? 'bg-primary-50 text-primary-600 border border-primary-200' : 'bg-gray-50 border border-gray-200 text-gray-500'
                    }`}>
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Audience */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between">
                <StepHeader num={2} title="Аудитория" />
                {recipientCount !== null && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                    <Users className="w-3 h-3" />
                    {loadingCount ? '...' : recipientCount} получателей
                  </span>
                )}
              </div>
              <div className="space-y-1.5 mt-3">
                {AUDIENCE_OPTIONS.map(opt => (
                  <label key={opt.value}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                      audience === opt.value ? 'bg-primary-50' : 'hover:bg-gray-50'
                    }`}>
                    <input type="radio" name="audience" value={opt.value}
                      checked={audience === opt.value} onChange={() => setAudience(opt.value)}
                      className="accent-primary-600" />
                    <div>
                      <span className="text-sm text-gray-900">{opt.label}</span>
                      <p className="text-xs text-gray-400">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Step 3: Message */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <StepHeader num={3} title="Сообщение" />
              <div className="space-y-4 mt-3">
                {/* Telegram fields */}
                {(channel === 'telegram' || channel === 'both') && (
                  <div className="space-y-3">
                    <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" /> Telegram
                    </label>
                    <textarea value={tgText} onChange={e => setTgText(e.target.value)}
                      placeholder="Текст сообщения (Markdown)" rows={5}
                      className="input w-full resize-y" />

                    {/* Media URL */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Медиа (URL изображения, необязательно)</label>
                      <div className="flex gap-2">
                        <ImageIcon className="w-4 h-4 text-gray-400 mt-2.5" />
                        <input value={tgMedia} onChange={e => setTgMedia(e.target.value)}
                          placeholder="https://example.com/image.jpg" className="input flex-1" />
                      </div>
                    </div>

                    {/* Inline buttons */}
                    <div className="space-y-2">
                      {tgButtons.map((btn, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input value={btn.label} onChange={e => updateTgButton(i, 'label', e.target.value)}
                            placeholder="Текст кнопки" className="input flex-1" />
                          <input value={btn.url} onChange={e => updateTgButton(i, 'url', e.target.value)}
                            placeholder="URL" className="input flex-1" />
                          <button onClick={() => removeTgButton(i)} className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {tgButtons.length < 5 && (
                        <button onClick={addTgButton}
                          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg text-primary-600 bg-primary-50 hover:bg-primary-100 transition-colors">
                          <Plus className="w-3.5 h-3.5" /> Добавить кнопку
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {channel === 'both' && <div className="border-t border-gray-100" />}

                {/* Email fields */}
                {(channel === 'email' || channel === 'both') && (
                  <div className="space-y-3">
                    <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </label>
                    <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                      placeholder="Тема письма" className="input w-full" />
                    <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)}
                      placeholder="Текст письма (HTML)" rows={6}
                      className="input w-full resize-y" />
                    <div className="flex gap-2">
                      <input value={emailCtaText} onChange={e => setEmailCtaText(e.target.value)}
                        placeholder="Текст CTA кнопки" className="input flex-1" />
                      <input value={emailCtaUrl} onChange={e => setEmailCtaUrl(e.target.value)}
                        placeholder="URL кнопки" className="input flex-1" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 4: Actions */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <StepHeader num={4} title="Отправка" />
              <div className="flex flex-wrap gap-3 mt-3">
                <button onClick={() => setShowPreview(true)} disabled={!canSend}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  <Eye className="w-4 h-4" /> Предпросмотр
                </button>
                <button onClick={() => setShowScheduler(true)} disabled={!canSend}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  <Calendar className="w-4 h-4" /> Запланировать
                </button>
                <button onClick={() => setConfirmSend(true)} disabled={!canSend}
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-40">
                  <Send className="w-4 h-4" /> Отправить сейчас
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {tab === 'history' && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {loadingHistory ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Send className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Рассылок пока нет</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Дата', 'Канал', 'Аудитория', 'Получателей', 'Отправлено', 'Ошибки', 'Статус', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(item => (
                      <>
                        <tr key={item.id}
                          className={`border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 ${expandedId === item.id ? 'bg-primary-50' : ''}`}
                          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-900">{fmtDate(item.createdAt)}</td>
                          <td className="px-4 py-3 text-gray-500">{CHANNEL_LABELS[item.channel] ?? item.channel}</td>
                          <td className="px-4 py-3 text-gray-500">{AUDIENCE_SHORT[item.audience] ?? item.audience}</td>
                          <td className="px-4 py-3 text-gray-500">{item.recipientCount}</td>
                          <td className="px-4 py-3 text-gray-500">{item.sentCount}</td>
                          <td className="px-4 py-3">
                            <span className={item.errorCount > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>{item.errorCount}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_CFG[item.status]?.cls || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                              {STATUS_CFG[item.status]?.label ?? item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === item.id ? 'rotate-180' : ''}`} />
                          </td>
                        </tr>
                        {expandedId === item.id && (
                          <tr key={`${item.id}-detail`}>
                            <td colSpan={8} className="px-4 py-4 bg-gray-50 border-b border-gray-100">
                              <div className="space-y-3 text-sm">
                                {item.telegramText && (
                                  <div>
                                    <span className="text-xs font-medium text-gray-500">Telegram:</span>
                                    <pre className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{item.telegramText}</pre>
                                  </div>
                                )}
                                {item.emailSubject && (
                                  <div>
                                    <span className="text-xs font-medium text-gray-500">Email:</span>
                                    <p className="mt-1 text-gray-900">{item.emailSubject}</p>
                                  </div>
                                )}
                                {item.scheduledAt && (
                                  <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <Clock className="w-3.5 h-3.5" /> Запланировано на {fmtDate(item.scheduledAt)}
                                  </div>
                                )}
                                <div className="flex gap-2 pt-1">
                                  {item.status === 'SCHEDULED' && (
                                    <button onClick={e => { e.stopPropagation(); cancelBroadcast(item.id) }}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-red-600 bg-red-50 hover:bg-red-100">
                                      <X className="w-3.5 h-3.5" /> Отменить
                                    </button>
                                  )}
                                  {['DRAFT', 'CANCELLED', 'COMPLETED'].includes(item.status) && (
                                    <button onClick={e => { e.stopPropagation(); deleteBroadcast(item.id) }}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-red-600 bg-red-50 hover:bg-red-100">
                                      <Trash2 className="w-3.5 h-3.5" /> Удалить
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Preview */}
      {showPreview && (
        <Modal onClose={() => setShowPreview(false)} title="Предпросмотр">
          {(channel === 'telegram' || channel === 'both') && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" /> Telegram
              </p>
              <div className="rounded-lg p-4 bg-gray-50 border border-gray-100">
                {tgMedia && (
                  <div className="mb-3 rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center h-32">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <pre className="whitespace-pre-wrap text-sm text-gray-900 font-sans">{tgText || '(пусто)'}</pre>
                {tgButtons.filter(b => b.label).length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {tgButtons.filter(b => b.label).map((btn, i) => (
                      <div key={i} className="text-center text-xs py-2 rounded-lg bg-primary-50 text-primary-600 font-medium">
                        {btn.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {(channel === 'email' || channel === 'both') && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email
              </p>
              <div className="rounded-lg p-4 bg-gray-50 border border-gray-100 space-y-2">
                <p className="font-medium text-gray-900">{emailSubject || '(без темы)'}</p>
                <div className="text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: emailBody || '(пусто)' }} />
                {emailCtaText && (
                  <div className="pt-2">
                    <span className="inline-block px-4 py-2 rounded-lg text-xs font-medium text-white bg-primary-600">
                      {emailCtaText}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Schedule */}
      {showScheduler && (
        <Modal onClose={() => setShowScheduler(false)} title="Запланировать рассылку" small>
          <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
            className="input w-full mb-4" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowScheduler(false)}
              className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Отмена</button>
            <button onClick={schedule} disabled={!scheduledAt || sending}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40">
              {sending ? 'Сохранение...' : 'Запланировать'}
            </button>
          </div>
        </Modal>
      )}

      {/* Confirm send */}
      {confirmSend && (
        <Modal onClose={() => setConfirmSend(false)} title="" small>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Подтвердите отправку</h3>
              <p className="text-xs text-gray-400">
                Канал: {CHANNEL_LABELS[channel]} | Аудитория: {recipientCount ?? '?'} получателей
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Рассылка будет отправлена немедленно. Это действие нельзя отменить.
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setConfirmSend(false)}
              className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Отмена</button>
            <button onClick={sendNow} disabled={sending}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-40">
              {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Отправка...</> : <><Send className="w-4 h-4" /> Отправить</>}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

/* ── Shared components ─────────────────────────── */

function StepHeader({ num, title }: { num: number; title: string }) {
  return (
    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
      <span className="w-6 h-6 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold">{num}</span>
      {title}
    </h3>
  )
}

function Modal({ children, onClose, title, small }: {
  children: React.ReactNode; onClose: () => void; title?: string; small?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`bg-white rounded-xl relative z-10 ${small ? 'max-w-sm' : 'max-w-lg'} w-full p-6 max-h-[80vh] overflow-y-auto shadow-xl`}>
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
