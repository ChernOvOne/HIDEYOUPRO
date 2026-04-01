'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Upload, Download, FileSpreadsheet, Trash2, ChevronRight,
  CheckCircle2, AlertCircle, Clock, RefreshCw, RotateCcw,
  Link2, Eye, Play, ArrowRight, X, FileText, Loader2,
  Regex, Zap, Users, CreditCard, ArrowDownToLine,
  History, ChevronDown, Info,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

type FileType = 'users' | 'payments' | 'transactions'

interface UploadedFile {
  id: string
  name: string
  type: FileType
  rowCount: number
  columns: string[]
  sampleData: Record<string, string>[]
  mapping: Record<string, string>
  autoMapping: Record<string, string>
}

interface RegexExtractor {
  fileId: string
  sourceColumn: string
  regex: string
  targetField: string
  extractedSamples: string[]
}

interface CrossFileLink {
  id: string
  sourceFileId: string
  sourceField: string
  sourceRegex: string
  targetFileId: string
  targetField: string
}

interface PreviewResult {
  users?: { create: number; update: number; skip: number; samples?: any[] }
  payments?: { create: number; link: number; noLink: number; samples?: any[] }
  referrals?: { link: number }
  errors?: string[]
}

interface ImportSession {
  id: string
  createdAt: string
  status: 'pending' | 'preview' | 'running' | 'completed' | 'failed' | 'rolled_back'
  files: { name: string; type: string; rows: number }[]
  stats?: {
    usersCreated: number
    usersUpdated: number
    paymentsCreated: number
    errors: number
  }
}

const FILE_TYPE_LABELS: Record<FileType, string> = {
  users: 'Пользователи',
  payments: 'Платежи',
  transactions: 'Транзакции',
}

type FieldDef = { value: string; label: string; hint: string; group: string; example?: string }

const SYSTEM_FIELDS: Record<FileType, FieldDef[]> = {
  users: [
    { value: '__skip', label: 'Пропустить', hint: 'Не импортировать эту колонку', group: '' },
    // Идентификация
    { value: 'legacyId', label: 'ID (старая система)', hint: 'Уникальный номер из прошлого сервиса. Нужен для связи с платежами', group: 'Идентификация', example: '14128800' },
    { value: 'telegramId', label: 'Telegram ID', hint: 'Числовой ID в Telegram (не username). По нему ищем пользователя в базе', group: 'Идентификация', example: '344322658' },
    { value: 'telegramName', label: 'Telegram Username', hint: 'Ник в телеграме без @', group: 'Идентификация', example: 'ivan_petrov' },
    { value: 'name', label: 'Имя', hint: 'Имя или ФИО пользователя', group: 'Идентификация', example: 'Иван Петров' },
    { value: 'email', label: 'Email', hint: 'Электронная почта. Тоже используется для поиска', group: 'Идентификация', example: 'user@mail.ru' },
    { value: 'phone', label: 'Телефон', hint: 'Номер телефона', group: 'Идентификация', example: '79991234567' },
    // VPN
    { value: 'remnawaveUuid', label: 'UUID REMNAWAVE', hint: 'UUID ключа в панели REMNAWAVE', group: 'VPN подписка', example: 'f1a7770e-0375-...' },
    { value: 'subLink', label: 'Ссылка подписки', hint: 'URL для подключения VPN', group: 'VPN подписка', example: 'https://user.example.com/sub/...' },
    { value: 'subStatus', label: 'Статус подписки', hint: 'ACTIVE, INACTIVE, EXPIRED или TRIAL', group: 'VPN подписка', example: 'ACTIVE' },
    { value: 'subExpireAt', label: 'Дата окончания', hint: 'Когда истекает подписка (ДД.ММ.ГГГГ или ISO)', group: 'VPN подписка', example: '25.12.2026' },
    // Финансы
    { value: 'balance', label: 'Баланс', hint: 'Текущий баланс в рублях', group: 'Финансы', example: '500.00' },
    { value: 'totalPaid', label: 'Всего оплачено', hint: 'Сумма всех платежей за всё время', group: 'Финансы', example: '2400.00' },
    { value: 'bonusDays', label: 'Бонусные дни', hint: 'Накопленные бонусные дни', group: 'Финансы', example: '30' },
    // Рефералы
    { value: 'referralCode', label: 'Реферальный код', hint: 'Код для приглашения друзей', group: 'Рефералы', example: 'abc123' },
    { value: 'referrerId', label: 'ID пригласившего', hint: 'Legacy ID того, кто пригласил этого пользователя', group: 'Рефералы', example: '14128800' },
    // Прочее
    { value: 'utmCode', label: 'UTM метка', hint: 'Откуда пришёл пользователь', group: 'Прочее', example: 'tg_channel' },
    { value: 'source', label: 'Источник', hint: 'Источник привлечения', group: 'Прочее', example: 'instagram' },
    { value: 'notes', label: 'Заметки / Теги', hint: 'Любой текст или теги через запятую', group: 'Прочее', example: 'VIP, промо' },
    { value: 'createdAt', label: 'Дата регистрации', hint: 'Когда пользователь зарегистрировался', group: 'Прочее', example: '15.11.2023' },
    { value: 'lastLoginAt', label: 'Последний вход', hint: 'Дата последнего входа', group: 'Прочее', example: '01.04.2026' },
    { value: 'isActive', label: 'Активен', hint: 'true или false — заблокирован ли', group: 'Прочее', example: 'true' },
    { value: 'role', label: 'Роль', hint: 'USER или ADMIN', group: 'Прочее', example: 'USER' },
  ],
  payments: [
    { value: '__skip', label: 'Пропустить', hint: 'Не импортировать', group: '' },
    // Привязка к пользователю
    { value: 'legacyId', label: 'ID пользователя (Legacy)', hint: 'Для привязки платежа к пользователю через ID старой системы', group: 'Привязка', example: '14128800' },
    { value: 'telegramId', label: 'Telegram ID', hint: 'Привязка по Telegram ID', group: 'Привязка', example: '344322658' },
    { value: 'userEmail', label: 'Email пользователя', hint: 'Привязка по email', group: 'Привязка', example: 'user@mail.ru' },
    // Платёж
    { value: 'amount', label: 'Сумма', hint: 'Сумма платежа', group: 'Платёж', example: '469.00' },
    { value: 'amountNet', label: 'К зачислению', hint: 'Сумма после комиссии', group: 'Платёж', example: '452.58' },
    { value: 'currency', label: 'Валюта', hint: 'RUB, USD, USDT', group: 'Платёж', example: 'RUB' },
    { value: 'status', label: 'Статус', hint: 'Оплачен, Отменен, В обработке', group: 'Платёж', example: 'Оплачен' },
    { value: 'method', label: 'Способ оплаты', hint: 'Банковская карта, Т-Pay, SberPay...', group: 'Платёж', example: 'Т-Pay' },
    { value: 'description', label: 'Описание', hint: 'Текст заказа. Можно извлечь ID через regex', group: 'Платёж', example: '[ID14128800] Иван' },
    { value: 'externalId', label: 'ID платежа', hint: 'Уникальный ID из платёжной системы', group: 'Платёж', example: '315f1f57-000f-...' },
    { value: 'provider', label: 'Провайдер', hint: 'YUKASSA, CRYPTOPAY, MANUAL', group: 'Платёж', example: 'YUKASSA' },
    // Даты
    { value: 'createdAt', label: 'Дата создания', hint: 'Когда заказ был создан', group: 'Даты', example: '01.04.2026 15:12:07' },
    { value: 'paidAt', label: 'Дата оплаты', hint: 'Когда деньги пришли', group: 'Даты', example: '01.04.2026 15:14:16' },
    // Доп.
    { value: 'cardNumber', label: 'Номер карты', hint: 'Маскированный номер', group: 'Дополнительно', example: '220015|5792' },
    { value: 'rrn', label: 'RRN', hint: 'Номер операции в банке', group: 'Дополнительно', example: '609116675610' },
    { value: 'refundAmount', label: 'Сумма возврата', hint: 'Если был возврат', group: 'Дополнительно', example: '469.00' },
    { value: 'refundDate', label: 'Дата возврата', hint: 'Когда вернули деньги', group: 'Дополнительно', example: '05.04.2026' },
  ],
  transactions: [
    { value: '__skip', label: 'Пропустить', hint: 'Не импортировать', group: '' },
    { value: 'type', label: 'Тип', hint: 'INCOME (доход) или EXPENSE (расход)', group: 'Транзакция', example: 'INCOME' },
    { value: 'amount', label: 'Сумма', hint: 'Сумма операции', group: 'Транзакция', example: '5000.00' },
    { value: 'description', label: 'Описание', hint: 'За что платёж', group: 'Транзакция', example: 'Оплата сервера' },
    { value: 'category', label: 'Категория', hint: 'Название категории (создастся если нет)', group: 'Транзакция', example: 'Серверы' },
    { value: 'createdAt', label: 'Дата', hint: 'Дата операции', group: 'Транзакция', example: '15.03.2026' },
    { value: 'legacyId', label: 'ID пользователя', hint: 'Для привязки к пользователю', group: 'Привязка', example: '14128800' },
    { value: 'telegramId', label: 'Telegram ID', hint: 'Привязка по TG ID', group: 'Привязка', example: '344322658' },
    { value: 'userEmail', label: 'Email', hint: 'Привязка по email', group: 'Привязка', example: 'user@mail.ru' },
  ],
}

const REGEX_PRESETS = [
  { label: '[ID{число}]', regex: '\\[ID(\\d+)\\]' },
  { label: '#{число}', regex: '#(\\d+)' },
  { label: 'ID_{число}', regex: 'ID_(\\d+)' },
  { label: '{число} - текст', regex: '^(\\d+)' },
  { label: '{email}', regex: '[\\w.-]+@[\\w.-]+' },
]

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function apiFetch(path: string, opts: RequestInit = {}) {
  return fetch(path, { credentials: 'include', ...opts })
}

function truncate(s: string, max = 24) {
  return s.length > max ? s.slice(0, max) + '…' : s
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function tryExtract(values: string[], regex: string): string[] {
  try {
    const re = new RegExp(regex)
    return values.map(v => {
      const m = v.match(re)
      return m ? (m[1] || m[0]) : '—'
    })
  } catch {
    return values.map(() => '—')
  }
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */

export default function AdminImportExport() {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import')
  const [step, setStep] = useState(1)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Step 1: files
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  // Step 2: mapping
  const [extractors, setExtractors] = useState<RegexExtractor[]>([])
  const [crossLinks, setCrossLinks] = useState<CrossFileLink[]>([])
  const [savingMapping, setSavingMapping] = useState(false)

  // Step 3: preview
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewing, setPreviewing] = useState(false)

  // Step 4: execute
  const [executing, setExecuting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')
  const [executeResult, setExecuteResult] = useState<any>(null)
  const [rollingBack, setRollingBack] = useState(false)

  // History
  const [history, setHistory] = useState<ImportSession[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Export
  const [exporting, setExporting] = useState<string | null>(null)
  // Error display
  const [renderError, setRenderError] = useState<string | null>(null)

  /* ─── Load history ─── */
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await apiFetch('/api/admin/data-import/sessions')
      if (res.ok) {
        const data = await res.json()
        setHistory(data.sessions || [])
      }
    } catch { /* ignore */ } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  /* ─── Step 1: Upload ─── */
  const createSession = async (): Promise<string> => {
    if (sessionId) return sessionId
    const res = await apiFetch('/api/admin/data-import/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!res.ok) throw new Error('Не удалось создать сессию импорта')
    const data = await res.json()
    setSessionId(data.id)
    return data.id
  }

  const uploadFiles = async (fileList: FileList) => {
    setUploading(true)
    try {
      const sid = await createSession()
      for (const file of Array.from(fileList)) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('type', 'users') // default, user can change
        const res = await apiFetch(`/api/admin/data-import/sessions/${sid}/files`, {
          method: 'POST',
          body: fd,
        })
        if (!res.ok) {
          toast.error(`Ошибка загрузки ${file.name}`)
          continue
        }
        const data = await res.json()
        // Backend returns headers[] and sampleRows[][] — convert to our format
        const columns = data.headers || data.columns || []
        const sampleData = (data.sampleRows || []).map((row: string[]) => {
          const obj: Record<string, string> = {}
          columns.forEach((col: string, i: number) => { obj[col] = row[i] || '' })
          return obj
        })
        setFiles(prev => [...prev, {
          id: data.fileId || uid(),
          name: file.name,
          type: 'users' as FileType,
          rowCount: data.rowCount || 0,
          columns,
          sampleData,
          mapping: data.autoMapping || {},
          autoMapping: data.autoMapping || {},
        }])
        toast.success(`${file.name} загружен (${data.rowCount || 0} строк)`)
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    setExtractors(prev => prev.filter(e => e.fileId !== id))
    setCrossLinks(prev => prev.filter(l => l.sourceFileId !== id && l.targetFileId !== id))
  }

  const changeFileType = (id: string, type: FileType) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, type } : f))
  }

  /* ─── Step 2: Mapping ─── */
  const updateMapping = (fileId: string, column: string, field: string) => {
    setFiles(prev => prev.map(f =>
      f.id === fileId
        ? { ...f, mapping: { ...f.mapping, [column]: field } }
        : f
    ))
  }

  const addExtractor = () => {
    if (!files.length) return
    setExtractors(prev => [...prev, {
      fileId: files[0].id,
      sourceColumn: files[0].columns[0] || '',
      regex: '',
      targetField: 'legacyId',
      extractedSamples: [],
    }])
  }

  const updateExtractor = (idx: number, patch: Partial<RegexExtractor>) => {
    setExtractors(prev => prev.map((e, i) => {
      if (i !== idx) return e
      const updated = { ...e, ...patch }
      // re-extract samples
      if (patch.regex !== undefined || patch.sourceColumn !== undefined || patch.fileId !== undefined) {
        const file = files.find(f => f.id === updated.fileId)
        if (file && updated.sourceColumn && updated.regex) {
          const vals = file.sampleData.map(r => r[updated.sourceColumn] || '')
          updated.extractedSamples = tryExtract(vals, updated.regex)
        }
      }
      return updated
    }))
  }

  const removeExtractor = (idx: number) => {
    setExtractors(prev => prev.filter((_, i) => i !== idx))
  }

  const addCrossLink = () => {
    if (files.length < 2) {
      toast.error('Нужно минимум 2 файла для связывания')
      return
    }
    setCrossLinks(prev => [...prev, {
      id: uid(),
      sourceFileId: files[0].id,
      sourceField: files[0].columns[0] || '',
      sourceRegex: '',
      targetFileId: files[1].id,
      targetField: files[1].columns[0] || '',
    }])
  }

  const updateCrossLink = (id: string, patch: Partial<CrossFileLink>) => {
    setCrossLinks(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }

  const removeCrossLink = (id: string) => {
    setCrossLinks(prev => prev.filter(l => l.id !== id))
  }

  const saveMapping = async () => {
    if (!sessionId) return
    setSavingMapping(true)
    try {
      const payload = {
        files: files.map(f => ({ id: f.id, type: f.type, mapping: f.mapping })),
        extractors: extractors.map(e => ({
          fileId: e.fileId,
          sourceColumn: e.sourceColumn,
          regex: e.regex,
          targetField: e.targetField,
        })),
        crossLinks: crossLinks.map(l => ({
          sourceFileId: l.sourceFileId,
          sourceField: l.sourceField,
          sourceRegex: l.sourceRegex,
          targetFileId: l.targetFileId,
          targetField: l.targetField,
        })),
      }
      const res = await apiFetch(`/api/admin/data-import/sessions/${sessionId}/mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Не удалось сохранить маппинг')
      toast.success('Маппинг сохранён')
      setStep(3)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSavingMapping(false)
    }
  }

  /* ─── Step 3: Preview ─── */
  const runPreview = async () => {
    if (!sessionId) return
    setPreviewing(true)
    setPreview(null)
    try {
      // Save mapping first (without step change)
      const payload = {
        files: files.map(f => ({ id: f.id, type: f.type, mapping: f.mapping })),
        extractors: extractors.map(e => ({
          fileId: e.fileId, sourceColumn: e.sourceColumn,
          regex: e.regex, targetField: e.targetField,
        })),
        crossLinks: crossLinks.map(l => ({
          sourceFileId: l.sourceFileId, sourceField: l.sourceField,
          sourceRegex: l.sourceRegex, targetFileId: l.targetFileId,
          targetField: l.targetField,
        })),
      }
      const mapRes = await apiFetch(`/api/admin/data-import/sessions/${sessionId}/mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!mapRes.ok) throw new Error('Не удалось сохранить маппинг')

      // Now run preview
      const res = await apiFetch(`/api/admin/data-import/sessions/${sessionId}/preview`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ошибка предварительного просмотра')
      setPreview(data)
      setStep(3)
      toast.success('Предварительный просмотр готов')
    } catch (err: any) {
      const msg = err?.message || String(err)
      setRenderError(`Preview error: ${msg}`)
      toast.error(msg || 'Ошибка')
      console.error('Preview error full:', err)
    } finally {
      setPreviewing(false)
    }
  }

  /* ─── Step 4: Execute ─── */
  const runExecute = async () => {
    if (!sessionId) return
    setExecuting(true)
    setProgress(0)
    setProgressText('Подготовка...')
    setExecuteResult(null)
    try {
      const res = await apiFetch(`/api/admin/data-import/sessions/${sessionId}/execute`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Ошибка ${res.status}. Попробуйте загрузить файл заново.`)
      }

      // simulate progress (real app would use SSE/WebSocket)
      const steps = [
        { pct: 15, text: 'Создание пользователей...' },
        { pct: 40, text: 'Импорт платежей...' },
        { pct: 65, text: 'Привязка транзакций...' },
        { pct: 85, text: 'Обработка рефералов...' },
        { pct: 100, text: 'Завершено!' },
      ]
      for (const s of steps) {
        await new Promise(r => setTimeout(r, 600))
        setProgress(s.pct)
        setProgressText(s.text)
      }

      const data = await res.json()
      setExecuteResult(data)
      toast.success('Импорт завершён!')
      loadHistory()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setExecuting(false)
    }
  }

  const runRollback = async (sid?: string) => {
    const targetId = sid || sessionId
    if (!targetId) return
    if (!confirm('Вы уверены? Все импортированные данные будут удалены.')) return
    setRollingBack(true)
    try {
      const res = await apiFetch(`/api/admin/data-import/sessions/${targetId}/rollback`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Ошибка отката')
      toast.success('Импорт откачен')
      loadHistory()
      if (targetId === sessionId) {
        setExecuteResult(null)
        setStep(1)
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setRollingBack(false)
    }
  }

  /* ─── Export ─── */
  const runExport = async (type: string) => {
    setExporting(type)
    try {
      const res = await apiFetch(`/api/admin/data-import/export/${type}`)
      if (!res.ok) throw new Error('Ошибка экспорта')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-${type}-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Файл скачан')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setExporting(null)
    }
  }

  /* ─── Reset ─── */
  const resetImport = () => {
    setSessionId(null)
    setFiles([])
    setExtractors([])
    setCrossLinks([])
    setPreview(null)
    setExecuteResult(null)
    setProgress(0)
    setProgressText('')
    setStep(1)
  }

  /* ═══════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Error display */}
      {renderError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800 font-medium text-sm">Ошибка: {renderError}</p>
          <button onClick={() => setRenderError(null)} className="text-red-600 text-xs mt-1 underline">Закрыть</button>
        </div>
      )}
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Импорт / Экспорт данных</h1>
        <p className="text-gray-500 text-sm mt-1">
          Загрузка данных из файлов и выгрузка в Excel
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {[
            { id: 'import' as const, label: 'Импорт данных', icon: Upload },
            { id: 'export' as const, label: 'Экспорт данных', icon: Download },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 px-1 text-sm transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600 font-medium'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ════════════════════ TAB: IMPORT ════════════════════ */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Steps indicator */}
          <div className="flex items-center gap-2 text-sm">
            {[
              { n: 1, label: 'Загрузка' },
              { n: 2, label: 'Маппинг' },
              { n: 3, label: 'Просмотр' },
              { n: 4, label: 'Импорт' },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                <button
                  onClick={() => { if (s.n <= step) setStep(s.n) }}
                  disabled={s.n > step}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                    step === s.n
                      ? 'bg-primary-600 text-white font-medium'
                      : s.n < step
                        ? 'bg-emerald-50 text-emerald-700 cursor-pointer'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {s.n < step ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <span className="w-4 h-4 text-xs flex items-center justify-center">{s.n}</span>
                  )}
                  {s.label}
                </button>
              </div>
            ))}
          </div>

          {/* ──── STEP 1: Upload ──── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Drag & drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragOver
                    ? 'border-primary-400 bg-primary-50/50'
                    : 'border-gray-200 hover:border-primary-300'
                }`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  multiple
                  className="hidden"
                  onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files) }}
                />
                <div className="flex flex-col items-center gap-3">
                  {uploading ? (
                    <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <Upload className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-gray-900 font-medium">
                      {uploading ? 'Загрузка файлов...' : 'Перетащите файлы сюда'}
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      или{' '}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-primary-600 hover:underline font-medium"
                        disabled={uploading}
                      >
                        выберите на компьютере
                      </button>
                    </p>
                    <p className="text-gray-400 text-xs mt-2">
                      Поддерживаются форматы: Excel (.xlsx, .xls) и CSV
                    </p>
                  </div>
                </div>
              </div>

              {/* Uploaded files list */}
              {files.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
                  {files.map(f => (
                    <div key={f.id} className="p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 text-sm font-medium truncate">{f.name}</p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {f.rowCount} строк · {f.columns.length} колонок
                          {f.columns.length > 0 && (
                            <span className="text-gray-400"> · {f.columns.slice(0, 3).join(', ')}{f.columns.length > 3 ? '...' : ''}</span>
                          )}
                        </p>
                      </div>
                      <select
                        value={f.type}
                        onChange={e => changeFileType(f.id, e.target.value as FileType)}
                        className="w-full max-w-[180px] border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                      >
                        {Object.entries(FILE_TYPE_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => removeFile(f.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Next step */}
              {files.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                  >
                    Далее: маппинг колонок
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ──── STEP 2: Column Mapping ──── */}
          {step === 2 && (
            <div className="space-y-6">
              {files.map(f => (
                <div key={f.id} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-primary-600" />
                      <div>
                        <h3 className="text-gray-900 font-medium text-sm">{f.name}</h3>
                        <p className="text-gray-500 text-xs">{FILE_TYPE_LABELS[f.type]} · {f.rowCount} строк · {f.columns.length} колонок</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        setFiles(prev => prev.map(file => file.id === f.id ? { ...file, mapping: { ...file.autoMapping } } : file))
                        toast.success('Автоматическое сопоставление')
                      }} className="text-xs px-3 py-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 font-medium">
                        Автоматически
                      </button>
                      <button onClick={() => {
                        const reset: Record<string, string> = {}
                        f.columns.forEach(c => { reset[c] = '__skip' })
                        setFiles(prev => prev.map(file => file.id === f.id ? { ...file, mapping: reset } : file))
                      }} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200">
                        Сбросить
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-xs space-y-1">
                    <p className="font-medium">Как сопоставить колонки:</p>
                    <p>Для каждой колонки из вашего файла выберите соответствующее поле в системе. Автоматически определённые показаны зелёным. Наведите на поле чтобы увидеть подсказку.</p>
                    <p>Колонки которые не нужно импортировать — оставьте "Пропустить".</p>
                  </div>

                  {/* Mapping rows */}
                  <div className="space-y-2">
                    {f.columns.map((col, idx) => {
                      const mapped = f.mapping[col] || '__skip'
                      const isAuto = f.autoMapping[col] && f.autoMapping[col] === mapped && mapped !== '__skip'
                      const isMapped = mapped !== '__skip'
                      const fieldDef = SYSTEM_FIELDS[f.type].find(sf => sf.value === mapped)

                      return (
                        <div key={col} className={`rounded-lg border p-3 transition-colors ${
                          isMapped ? 'border-primary-200 bg-primary-50/30' : 'border-gray-100 bg-white'
                        }`}>
                          <div className="flex items-start gap-4">
                            {/* Left: file column */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-gray-900 text-sm font-medium">{col}</p>
                                {isAuto && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">авто</span>
                                )}
                                {isMapped && !isAuto && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-100 text-primary-700">вручную</span>
                                )}
                              </div>
                              {f.sampleData.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {f.sampleData.slice(0, 3).map((row, ri) => (
                                    <span key={ri} className="text-[11px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[160px] inline-block">
                                      {truncate(row[col] || '—', 24)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Right: system field */}
                            <div className="w-[280px] flex-shrink-0">
                              <select
                                value={mapped}
                                onChange={e => updateMapping(f.id, col, e.target.value)}
                                className={`w-full border rounded-lg px-3 py-2 text-sm bg-white cursor-pointer ${
                                  isMapped ? 'border-primary-300 text-primary-700 font-medium' : 'border-gray-200 text-gray-500'
                                }`}
                              >
                                {(() => {
                                  const groups = new Map<string, FieldDef[]>()
                                  for (const sf of SYSTEM_FIELDS[f.type]) {
                                    const g = sf.group || ''
                                    if (!groups.has(g)) groups.set(g, [])
                                    groups.get(g)!.push(sf)
                                  }
                                  const elements: JSX.Element[] = []
                                  groups.forEach((fields, group) => {
                                    if (group) {
                                      elements.push(
                                        <optgroup key={group} label={`── ${group} ──`}>
                                          {fields.map(sf => (
                                            <option key={sf.value} value={sf.value} title={sf.hint}>
                                              {sf.label}{sf.example ? `  (${sf.example})` : ''}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )
                                    } else {
                                      fields.forEach(sf => {
                                        elements.push(<option key={sf.value} value={sf.value}>{sf.label}</option>)
                                      })
                                    }
                                  })
                                  return elements
                                })()}
                              </select>
                              {fieldDef && fieldDef.value !== '__skip' && (
                                <p className="text-[10px] text-gray-400 mt-1 pl-1">{fieldDef.hint}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Summary */}
                  <div className="flex items-center gap-4 text-xs text-gray-400 pt-2">
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> {f.columns.filter(c => f.mapping[c] && f.mapping[c] !== '__skip').length} сопоставлено</span>
                    <span>{f.columns.filter(c => !f.mapping[c] || f.mapping[c] === '__skip').length} пропущено</span>
                  </div>
                </div>
              ))}

              {/* ═══ Unified: Связь между файлами + Regex ═══ */}
              {files.length >= 2 && (
                <div className="bg-white rounded-xl border border-amber-200 p-5 space-y-5">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 className="w-5 h-5 text-amber-600" />
                      <h3 className="text-gray-900 font-medium">Связь между файлами</h3>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-50 text-amber-800 text-xs space-y-2">
                      <p className="font-medium">Зачем это нужно?</p>
                      <p>Если у вас два файла (например, Пользователи и Платежи), нужно указать как их связать. Обычно платёж содержит ID пользователя в каком-то поле.</p>
                      <p><b>Пример:</b> В файле платежей колонка "Описание" содержит текст <code className="bg-amber-100 px-1 rounded">[ID14128800] Иван</code>. Число 14128800 — это ID пользователя из файла контактов. Regex <code className="bg-amber-100 px-1 rounded">\[ID(\d+)\]</code> извлечёт это число.</p>
                    </div>
                  </div>

                  {crossLinks.length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-gray-400 text-sm mb-3">Связи не настроены — платежи не будут привязаны к пользователям</p>
                      <button onClick={addCrossLink}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors">
                        <Link2 className="w-4 h-4" /> Настроить связь
                      </button>
                    </div>
                  )}

                  {crossLinks.map(link => {
                    const srcFile = files.find(f => f.id === link.sourceFileId)
                    const tgtFile = files.find(f => f.id === link.targetFileId)

                    // Live preview: extract values from source using regex
                    const srcSamples = srcFile?.sampleData?.slice(0, 5).map(r => r[link.sourceField] || '') || []
                    const extractedSamples = link.sourceRegex ? tryExtract(srcSamples, link.sourceRegex) : srcSamples
                    const tgtSamples = tgtFile?.sampleData?.slice(0, 5).map(r => r[link.targetField] || '') || []
                    const matchCount = extractedSamples.filter((v, i) => v !== '—' && tgtSamples.some(t => t === v)).length

                    return (
                      <div key={link.id} className="border border-gray-200 rounded-xl p-5 space-y-4 bg-gray-50/50">
                        {/* Step 1: Source file + column */}
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center">1</span>
                            Откуда берём ID?
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <select value={link.sourceFileId} onChange={e => updateCrossLink(link.id, { sourceFileId: e.target.value })}
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                              {files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                            <select value={link.sourceField} onChange={e => updateCrossLink(link.id, { sourceField: e.target.value })}
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                              {(srcFile?.columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          {srcSamples.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              <span className="text-[10px] text-gray-400">Примеры:</span>
                              {srcSamples.slice(0, 3).map((v, i) => (
                                <span key={i} className="text-[11px] font-mono bg-white border border-gray-200 px-1.5 py-0.5 rounded truncate max-w-[180px]">{truncate(v || '—', 30)}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Step 2: Regex */}
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center">2</span>
                            Нужно извлечь ID из текста? (если ID спрятан внутри строки)
                          </p>
                          <input value={link.sourceRegex} onChange={e => updateCrossLink(link.id, { sourceRegex: e.target.value })}
                            placeholder="Оставьте пустым если колонка уже содержит чистый ID"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white font-mono" />

                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="text-[10px] text-gray-400 py-1">Шаблоны:</span>
                            {REGEX_PRESETS.map(p => (
                              <button key={p.label} onClick={() => updateCrossLink(link.id, { sourceRegex: p.regex })}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                                  link.sourceRegex === p.regex
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700'
                                }`}>
                                {p.label}
                              </button>
                            ))}
                          </div>

                          {/* Live regex preview */}
                          {link.sourceRegex && (
                            <div className="mt-2 p-2.5 rounded-lg bg-white border border-gray-200">
                              <p className="text-[10px] text-gray-400 mb-1.5">Результат извлечения:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {srcSamples.slice(0, 5).map((v, i) => {
                                  const extracted = extractedSamples[i]
                                  return (
                                    <div key={i} className="text-[11px] space-y-0.5">
                                      <div className="font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded truncate max-w-[200px]">{truncate(v || '—', 28)}</div>
                                      <div className="text-center text-gray-300">↓</div>
                                      <div className={`font-mono font-medium px-1.5 py-0.5 rounded ${
                                        extracted === '—' ? 'bg-red-50 text-red-400' : 'bg-emerald-50 text-emerald-700'
                                      }`}>{extracted}</div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Step 3: Target */}
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center">3</span>
                            Где искать совпадение?
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <select value={link.targetFileId} onChange={e => updateCrossLink(link.id, { targetFileId: e.target.value })}
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                              {files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                            <select value={link.targetField} onChange={e => updateCrossLink(link.id, { targetField: e.target.value })}
                              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                              {(tgtFile?.columns || []).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          {tgtSamples.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              <span className="text-[10px] text-gray-400">Примеры:</span>
                              {tgtSamples.slice(0, 3).map((v, i) => (
                                <span key={i} className="text-[11px] font-mono bg-white border border-gray-200 px-1.5 py-0.5 rounded truncate max-w-[120px]">{truncate(v || '—', 16)}</span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Match indicator */}
                        <div className={`flex items-center justify-between p-3 rounded-lg ${
                          matchCount > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-100'
                        }`}>
                          <div className="flex items-center gap-2">
                            {matchCount > 0
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              : <AlertCircle className="w-4 h-4 text-gray-400" />
                            }
                            <span className={`text-xs font-medium ${matchCount > 0 ? 'text-emerald-700' : 'text-gray-500'}`}>
                              {matchCount > 0
                                ? `Найдено совпадений в примерах: ${matchCount} из ${extractedSamples.filter(v => v !== '—').length}`
                                : 'Совпадений в примерах не найдено (проверьте настройки)'
                              }
                            </span>
                          </div>
                          <button onClick={() => removeCrossLink(link.id)} className="text-xs text-red-400 hover:text-red-600">Удалить</button>
                        </div>
                      </div>
                    )
                  })}

                  {crossLinks.length > 0 && (
                    <button onClick={addCrossLink}
                      className="w-full py-2 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-amber-300 hover:text-amber-600 transition-colors">
                      + Добавить ещё связь
                    </button>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Назад
                </button>
                <button
                  onClick={saveMapping}
                  disabled={savingMapping}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {savingMapping && <Loader2 className="w-4 h-4 animate-spin" />}
                  Сохранить и продолжить
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ──── STEP 3: Preview ──── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-gray-900 font-medium">Предварительный просмотр</h3>
                  <button
                    onClick={runPreview}
                    disabled={previewing}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {previewing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                    Предварительный просмотр
                  </button>
                </div>

                {previewing && (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                      <p className="text-gray-500 text-sm">Анализ данных...</p>
                    </div>
                  </div>
                )}

                {preview && (
                  <div className="space-y-4">
                    {/* Stats cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-emerald-50 rounded-lg p-3">
                        <p className="text-emerald-700 text-xs font-medium">Пользователи</p>
                        <p className="text-emerald-800 text-lg font-bold mt-1">{preview.users?.create ?? 0}</p>
                        <p className="text-emerald-600 text-xs">создать</p>
                        <div className="text-emerald-600 text-xs mt-0.5">
                          {preview.users?.update ?? 0} обновить · {preview.users?.skip ?? 0} пропустить
                        </div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-blue-700 text-xs font-medium">Платежи</p>
                        <p className="text-blue-800 text-lg font-bold mt-1">{preview.payments?.create ?? 0}</p>
                        <p className="text-blue-600 text-xs">создать</p>
                        <div className="text-blue-600 text-xs mt-0.5">
                          {preview.payments?.link ?? 0} привязать · {preview.payments?.noLink ?? 0} без связи
                        </div>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3">
                        <p className="text-purple-700 text-xs font-medium">Рефералы</p>
                        <p className="text-purple-800 text-lg font-bold mt-1">{preview.referrals?.link ?? 0}</p>
                        <p className="text-purple-600 text-xs">связать</p>
                      </div>
                      <div className={`rounded-lg p-3 ${(preview.errors?.length || 0) > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                        <p className={`text-xs font-medium ${(preview.errors?.length || 0) > 0 ? 'text-red-600' : 'text-gray-500'}`}>Ошибки</p>
                        <p className={`text-lg font-bold mt-1 ${(preview.errors?.length || 0) > 0 ? 'text-red-700' : 'text-gray-700'}`}>
                          {(preview.errors?.length || 0)}
                        </p>
                        <p className={`text-xs ${(preview.errors?.length || 0) > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {(preview.errors?.length || 0) > 0 ? 'найдено' : 'нет ошибок'}
                        </p>
                      </div>
                    </div>

                    {/* Errors */}
                    {(preview.errors?.length || 0) > 0 && (
                      <div className="bg-red-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          <p className="text-red-700 text-sm font-medium">Ошибки ({(preview.errors?.length || 0)})</p>
                        </div>
                        <ul className="space-y-1">
                          {(preview.errors || []).slice(0, 10).map((err: string, i: number) => (
                            <li key={i} className="text-red-600 text-xs">• {err}</li>
                          ))}
                          {(preview.errors?.length || 0) > 10 && (
                            <li className="text-red-400 text-xs">... и ещё {(preview.errors?.length || 0) - 10}</li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Sample records */}
                    {(preview.users?.samples?.length || 0) > 0 && (
                      <div>
                        <p className="text-gray-500 text-xs font-medium mb-2 uppercase tracking-wide">
                          Пример записей (первые {preview.users?.samples?.length || 0})
                        </p>
                        <div className="border border-gray-100 rounded-lg overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50">
                                {Object.keys((preview.users?.samples || preview.payments?.samples || [])[0] || {}).map(key => (
                                  <th key={key} className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(preview.users?.samples || preview.payments?.samples || []).map((row: any, i: number) => (
                                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                  {Object.values(row).map((val, j) => (
                                    <td key={j} className="px-3 py-2 text-gray-700 font-mono whitespace-nowrap max-w-[200px] truncate">
                                      {String(val ?? '—')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Назад
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={!preview}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Далее: запуск импорта
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ──── STEP 4: Execute ──── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-5">
                <h3 className="text-gray-900 font-medium">Запуск импорта</h3>

                {!executeResult && !executing && (
                  <div className="bg-blue-50 rounded-lg p-4 flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-blue-800 text-sm font-medium">Готово к импорту</p>
                      <p className="text-blue-600 text-xs mt-1">
                        Все данные будут записаны в базу. При необходимости импорт можно будет откатить.
                      </p>
                    </div>
                  </div>
                )}

                {/* Progress */}
                {executing && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{progressText}</span>
                      <span className="text-gray-900 font-medium">{progress}%</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-primary-600 rounded-full h-2 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Result */}
                {executeResult && (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 rounded-lg p-4 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-emerald-800 text-sm font-medium">Импорт завершён успешно</p>
                        <div className="text-emerald-700 text-xs mt-2 space-y-0.5">
                          {executeResult.usersCreated !== undefined && (
                            <p>Пользователей создано: {executeResult.usersCreated}</p>
                          )}
                          {executeResult.usersUpdated !== undefined && (
                            <p>Пользователей обновлено: {executeResult.usersUpdated}</p>
                          )}
                          {executeResult.paymentsCreated !== undefined && (
                            <p>Платежей создано: {executeResult.paymentsCreated}</p>
                          )}
                          {executeResult.transactionsCreated !== undefined && (
                            <p>Транзакций создано: {executeResult.transactionsCreated}</p>
                          )}
                          {executeResult.referralsLinked !== undefined && (
                            <p>Рефералов связано: {executeResult.referralsLinked}</p>
                          )}
                          {executeResult.errors !== undefined && executeResult.errors > 0 && (
                            <p className="text-red-600">Ошибок: {executeResult.errors}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => runRollback()}
                        disabled={rollingBack}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {rollingBack ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )}
                        Откатить импорт
                      </button>
                      <button
                        onClick={resetImport}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Новый импорт
                      </button>
                    </div>
                  </div>
                )}

                {/* Execute button */}
                {!executeResult && (
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setStep(3)}
                      disabled={executing}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      Назад
                    </button>
                    <button
                      onClick={runExecute}
                      disabled={executing}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                      {executing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Запустить импорт
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──── Import History ──── */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-gray-400" />
                <h3 className="text-gray-900 font-medium text-sm">История импортов</h3>
              </div>
              <button
                onClick={loadHistory}
                disabled={loadingHistory}
                className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {history.length === 0 && !loadingHistory && (
              <p className="text-gray-400 text-sm py-4 text-center">Нет выполненных импортов</p>
            )}

            {loadingHistory && history.length === 0 && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
              </div>
            )}

            {history.length > 0 && (
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-2.5">Дата</th>
                      <th className="text-left px-4 py-2.5">Файлы</th>
                      <th className="text-left px-4 py-2.5">Результат</th>
                      <th className="text-left px-4 py-2.5">Статус</th>
                      <th className="text-right px-4 py-2.5">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((session, i) => (
                      <tr key={session.id} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-3 text-gray-900 text-xs whitespace-nowrap">
                          {new Date(session.createdAt).toLocaleString('ru-RU', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {session.files.map((f, fi) => (
                              <span key={fi} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                {f.name} ({f.rows})
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {session.stats && (
                            <span>
                              +{session.stats.usersCreated} польз. · +{session.stats.paymentsCreated} плат.
                              {session.stats.errors > 0 && (
                                <span className="text-red-500"> · {session.stats.errors} ош.</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            session.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                            session.status === 'failed' ? 'bg-red-50 text-red-600' :
                            session.status === 'rolled_back' ? 'bg-yellow-50 text-yellow-700' :
                            session.status === 'running' ? 'bg-blue-50 text-blue-600' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {session.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                            {session.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                            {session.status === 'rolled_back' && <RotateCcw className="w-3 h-3" />}
                            {session.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
                            {session.status === 'completed' ? 'Завершён' :
                             session.status === 'failed' ? 'Ошибка' :
                             session.status === 'rolled_back' ? 'Откачен' :
                             session.status === 'running' ? 'Выполняется' :
                             session.status === 'preview' ? 'Просмотр' : 'Ожидание'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {session.status === 'completed' && (
                            <button
                              onClick={() => runRollback(session.id)}
                              disabled={rollingBack}
                              className="text-xs text-red-500 hover:text-red-700 font-medium"
                            >
                              Откатить
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════ TAB: EXPORT ════════════════════ */}
      {activeTab === 'export' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-2">
            <h3 className="text-gray-900 font-medium mb-4">Экспорт данных в Excel</h3>
            <p className="text-gray-500 text-sm mb-6">
              Выберите тип данных для выгрузки. Файл будет скачан в формате .xlsx.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  type: 'users',
                  icon: Users,
                  label: 'Пользователи',
                  desc: 'Все пользователи с подписками и балансами',
                  color: 'text-blue-600 bg-blue-50',
                },
                {
                  type: 'payments',
                  icon: CreditCard,
                  label: 'Платежи',
                  desc: 'История всех платежей и транзакций',
                  color: 'text-emerald-600 bg-emerald-50',
                },
                {
                  type: 'transactions',
                  icon: ArrowDownToLine,
                  label: 'Транзакции',
                  desc: 'Движение средств по балансам',
                  color: 'text-purple-600 bg-purple-50',
                },
                {
                  type: 'full',
                  icon: FileText,
                  label: 'Полный экспорт',
                  desc: 'Все данные на отдельных листах',
                  color: 'text-orange-600 bg-orange-50',
                },
              ].map(item => (
                <button
                  key={item.type}
                  onClick={() => runExport(item.type)}
                  disabled={exporting !== null}
                  className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 transition-all text-left group disabled:opacity-50"
                >
                  <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center flex-shrink-0`}>
                    {exporting === item.type ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <item.icon className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-gray-900 text-sm font-medium group-hover:text-primary-700 transition-colors">
                      {item.label}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">{item.desc}</p>
                  </div>
                  <Download className="w-4 h-4 text-gray-300 group-hover:text-primary-400 ml-auto mt-1 flex-shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-800 text-sm font-medium">Формат экспорта</p>
              <p className="text-blue-600 text-xs mt-1">
                Данные экспортируются в формате Excel (.xlsx). Полный экспорт содержит отдельные листы для каждого типа данных.
                Файл скачивается автоматически.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
