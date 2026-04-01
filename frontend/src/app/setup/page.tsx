'use client'

import { useState, useEffect, memo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2, Wifi, MessageCircle, CreditCard, CheckCircle2, ChevronRight,
  Loader2, SkipForward, Globe, Mail, Users, DollarSign, ChevronLeft, Upload, Download, FileSpreadsheet, CheckCircle,
} from 'lucide-react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'

// Field and Toggle defined OUTSIDE the component to avoid re-mount on state change
const Field = memo(({ label, value, onChange, type, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string
}) => (
  <div>
    <label className="text-xs font-medium text-gray-500 mb-1 block">{label}</label>
    <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)}
      className="input" placeholder={placeholder} />
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
))
Field.displayName = 'Field'

const ToggleField = memo(({ label, checked, onChange, hint }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string
}) => (
  <div className="flex items-center justify-between py-2">
    <div>
      <span className="text-sm text-gray-700">{label}</span>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
    <button type="button" onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full transition-colors ${checked ? 'bg-primary-600' : 'bg-gray-200'}`}>
      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  </div>
))

const STEPS = [
  { id: 'company',   icon: Building2,      title: 'Компания',        desc: 'Название, валюта, поддержка' },
  { id: 'domains',   icon: Globe,          title: 'Домены',          desc: 'ЛК, MiniApp, Webhook' },
  { id: 'remnawave', icon: Wifi,           title: 'REMNAWAVE',       desc: 'Подключение VPN-панели' },
  { id: 'telegram',  icon: MessageCircle,  title: 'Telegram бот',    desc: 'Токен и username бота' },
  { id: 'payments',  icon: CreditCard,     title: 'Платежи',         desc: 'ЮKassa, CryptoPay, Stars' },
  { id: 'email',     icon: Mail,           title: 'Email (SMTP)',    desc: 'Рассылки и уведомления' },
  { id: 'referral',  icon: Users,          title: 'Рефералы',        desc: 'Бонусы за приглашения' },
  { id: 'accounting',icon: DollarSign,     title: 'Бухгалтерия',     desc: 'Баланс, категории, расходы' },
  { id: 'import',    icon: Upload,         title: 'Импорт данных',    desc: 'Загрузка из Excel' },
  { id: 'servers',   icon: Globe,          title: 'Серверы',          desc: 'VPS и хостинг' },
  { id: 'partners',  icon: Users,          title: 'Партнёры',         desc: 'Инвесторы и доли' },
]

const SKIP_ALLOWED = new Set(['domains', 'remnawave', 'telegram', 'payments', 'email', 'referral', 'accounting', 'import', 'servers', 'partners'])

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({
    // Компания
    companyName: '', currency: 'RUB', timezone: 'Europe/Moscow',
    supportUrl: '', tgChannel: '',
    // Домены
    lkDomain: '', lkUrl: '', webhookDomain: '', miniappUrl: '',
    // REMNAWAVE
    remnawaveUrl: '', remnawaveToken: '',
    // Telegram
    botToken: '', botName: '',
    // Платежи
    yukassaShopId: '', yukassaSecretKey: '', cryptopayToken: '', starsEnabled: 'false',
    // Email
    smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '', smtpFrom: '',
    // Рефералы
    referralEnabled: 'true', referralBonusDays: '30', referralMinDays: '30',
    // Бухгалтерия
    defaultCategories: 'true',
    startingBalance: '0',
  })

  // Dynamic lists for servers and partners
  const [customCats, setCustomCats] = useState<{ name: string; type: string; color: string }[]>([])
  const [servers, setServers] = useState<{ name: string; provider: string; ip: string; monthlyCost: string; currency: string }[]>([])
  const [partners, setPartners] = useState<{ name: string; role: string; share: string; contact: string }[]>([])
  const [recurringExpenses, setRecurringExpenses] = useState<{ name: string; amount: string; paymentDay: string }[]>([])

  // Import step state
  const [importResults, setImportResults] = useState<Record<string, { imported?: number; errors?: string[] }>>({})
  const [importLoading, setImportLoading] = useState<Record<string, boolean>>({})

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
      setImportLoading(p => ({ ...p, [type]: true }))
      const formData = new FormData()
      formData.append('file', file)
      try {
        const res = await fetch(`/api/admin/import-excel/import/${type}`, {
          method: 'POST', credentials: 'include', body: formData,
        })
        const data = await res.json()
        setImportResults(p => ({ ...p, [type]: { imported: data.imported, errors: data.errors } }))
        toast.success(`Импортировано: ${data.imported}`)
        if (data.errors?.length) toast.error(`Ошибки: ${data.errors.length}`)
      } catch {
        toast.error('Ошибка импорта')
      }
      setImportLoading(p => ({ ...p, [type]: false }))
    }
    input.click()
  }

  useEffect(() => {
    api.me().catch(() => router.push('/login'))
  }, [router])

  const upd = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }))

  const saveStep = async () => {
    setLoading(true)
    try {
      const s = STEPS[step].id
      switch (s) {
        case 'company':
          await api.setupCompany({
            companyName: form.companyName, currency: form.currency,
            timezone: form.timezone, supportUrl: form.supportUrl, tgChannel: form.tgChannel,
          })
          break
        case 'domains':
          await api.updateSettings({
            lk_domain: form.lkDomain, lk_url: form.lkUrl,
            webhook_domain: form.webhookDomain, miniapp_url: form.miniappUrl,
          })
          break
        case 'remnawave':
          if (form.remnawaveUrl && form.remnawaveToken)
            await api.setupRemnawave({ url: form.remnawaveUrl, token: form.remnawaveToken })
          break
        case 'telegram':
          if (form.botToken && form.botName)
            await api.setupTelegram({ botToken: form.botToken, botName: form.botName })
          break
        case 'payments':
          await api.setupPayments({
            yukassaShopId: form.yukassaShopId || undefined,
            yukassaSecretKey: form.yukassaSecretKey || undefined,
            cryptopayToken: form.cryptopayToken || undefined,
            starsEnabled: form.starsEnabled,
          })
          break
        case 'email':
          await api.updateSettings({
            smtp_host: form.smtpHost, smtp_port: form.smtpPort,
            smtp_user: form.smtpUser, smtp_pass: form.smtpPass, smtp_from: form.smtpFrom,
          })
          break
        case 'referral':
          await api.updateSettings({
            referral_enabled: form.referralEnabled,
            referral_bonus_days: form.referralBonusDays,
            referral_min_days: form.referralMinDays,
          })
          break
        case 'accounting':
          if (form.defaultCategories === 'true') {
            // Создаём стандартные категории
            const cats = [
              { name: 'Серверы', type: 'EXPENSE', color: '#EF4444' },
              { name: 'Реклама', type: 'EXPENSE', color: '#F59E0B' },
              { name: 'Зарплаты', type: 'EXPENSE', color: '#8B5CF6' },
              { name: 'Подписки (сервисы)', type: 'EXPENSE', color: '#EC4899' },
              { name: 'Прочие расходы', type: 'EXPENSE', color: '#6B7280' },
              { name: 'Оплата VPN', type: 'INCOME', color: '#10B981' },
              { name: 'Рефералы', type: 'INCOME', color: '#3B82F6' },
              { name: 'Прочие доходы', type: 'INCOME', color: '#14B8A6' },
            ]
            for (const c of cats) {
              try {
                await fetch('/api/admin/accounting/categories', {
                  method: 'POST', credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(c),
                })
              } catch {}
            }
          }
          // Custom categories
          for (const c of customCats.filter(c => c.name.trim())) {
            try {
              await fetch('/api/admin/accounting/categories', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(c),
              })
            } catch {}
          }
          // Starting balance as transaction
          if (Number(form.startingBalance) > 0) {
            try {
              await fetch('/api/admin/accounting/transactions', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'INCOME', amount: Number(form.startingBalance),
                  description: 'Начальный остаток на счёте',
                  date: new Date().toISOString().split('T')[0],
                }),
              })
            } catch {}
          }
          // Recurring expenses
          for (const r of recurringExpenses.filter(r => r.name.trim() && r.amount)) {
            try {
              await fetch('/api/admin/extras/recurring', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: r.name, amount: Number(r.amount), paymentDay: Number(r.paymentDay) || 1, currency: 'RUB' }),
              })
            } catch {}
          }
          break
        case 'import':
          // Import is handled inline via downloadTemplate/importExcel helpers
          break
        case 'servers':
          for (const s of servers.filter(s => s.name.trim())) {
            try {
              await fetch('/api/admin/servers', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: s.name, provider: s.provider, ipAddress: s.ip, monthlyCost: Number(s.monthlyCost) || 0, currency: s.currency }),
              })
            } catch {}
          }
          break
        case 'partners':
          for (const p of partners.filter(p => p.name.trim())) {
            try {
              await fetch('/api/admin/partners', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: p.name, role: p.role || 'partner', share: Number(p.share) || 0, contact: p.contact }),
              })
            } catch {}
          }
          break
      }

      if (step < STEPS.length - 1) {
        setStep(step + 1)
        toast.success('Сохранено')
      } else {
        await api.setupComplete()
        toast.success('Настройка завершена!')
        router.push('/admin')
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка')
    }
    setLoading(false)
  }

  const skip = () => {
    if (step < STEPS.length - 1) setStep(step + 1)
    else api.setupComplete().then(() => router.push('/admin'))
  }

  const back = () => { if (step > 0) setStep(step - 1) }

  // Helper to create Field props from form key
  const f = (label: string, k: string, opts?: { type?: string; placeholder?: string; hint?: string }) => ({
    label, value: form[k] || '', onChange: (v: string) => upd(k, v), ...opts,
  })
  const t = (label: string, k: string, hint?: string) => ({
    label, checked: form[k] === 'true', onChange: (v: boolean) => upd(k, String(v)), hint,
  })

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="flex items-center justify-center gap-1 mb-6 flex-wrap">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1">
              <button onClick={() => i < step && setStep(i)}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
                  i < step ? 'bg-emerald-600 text-white cursor-pointer' :
                  i === step ? 'bg-primary-600 text-white' :
                  'bg-gray-200 text-gray-400'
                }`}
                title={s.title}>
                {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : <s.icon className="w-3.5 h-3.5" />}
              </button>
              {i < STEPS.length - 1 && <div className={`w-4 h-0.5 ${i < step ? 'bg-emerald-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="text-center mb-4">
          <span className="text-xs text-gray-400">Шаг {step + 1} из {STEPS.length}</span>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-lg font-semibold mb-1">{STEPS[step].title}</h2>
          <p className="text-sm text-gray-400 mb-5">{STEPS[step].desc}</p>

          {/* === Компания === */}
          {step === 0 && (
            <div className="space-y-4">
              <Field {...f('Название проекта *', 'companyName', { placeholder: 'HIDEYOU VPN' })} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Валюта</label>
                  <select value={form.currency} onChange={e => upd('currency', e.target.value)} className="input bg-white">
                    <option value="RUB">RUB (рубли)</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="USDT">USDT</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Таймзона</label>
                  <select value={form.timezone} onChange={e => upd('timezone', e.target.value)} className="input bg-white">
                    <option value="Europe/Moscow">Москва (UTC+3)</option>
                    <option value="Europe/Kiev">Киев (UTC+2)</option>
                    <option value="Asia/Almaty">Алматы (UTC+6)</option>
                    <option value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>
              <Field {...f("Ссылка на поддержку", "supportUrl", { placeholder: "https://t.me/support" })} />
              <Field {...f("Telegram-канал", "tgChannel", { placeholder: "https://t.me/channel" })} />
            </div>
          )}

          {/* === Домены === */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-xs">
                Укажите домены для личного кабинета и webhook. Можно пропустить и настроить позже.
              </div>
              <Field {...f("Домен ЛК", "lkDomain", { placeholder: "lk.example.com", hint: "Домен личного кабинета пользователя" })} />
              <Field {...f("URL ЛК", "lkUrl", { placeholder: "https://lk.example.com", hint: "Полный URL (с https://)" })} />
              <Field {...f("Домен Webhook", "webhookDomain", { placeholder: "api.example.com", hint: "Домен для приёма webhook от платёжных систем" })} />
              <Field {...f("MiniApp URL", "miniappUrl", { placeholder: "https://app.example.com", hint: "URL Telegram MiniApp (кнопка в боте)" })} />
            </div>
          )}

          {/* === REMNAWAVE === */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-xs">
                Подключите REMNAWAVE-панель для управления VPN-подписками. Можно пропустить.
              </div>
              <Field {...f("URL панели", "remnawaveUrl", { placeholder: "https://panel.example.com" })} />
              <Field {...f("API токен", "remnawaveToken", { type: "password", placeholder: "Bearer token" })} />
            </div>
          )}

          {/* === Telegram === */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-xs">
                Создайте бота через @BotFather и вставьте токен. Можно пропустить.
              </div>
              <Field {...f("Токен бота", "botToken", { type: "password", placeholder: "123456:ABC-DEF..." })} />
              <Field {...f("Username бота (без @)", "botName", { placeholder: "MyVPNBot" })} />
            </div>
          )}

          {/* === Платежи === */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-xs">
                Подключите платёжные системы. Все поля необязательны.
              </div>
              <p className="text-xs font-medium text-gray-500 pt-1">ЮKassa</p>
              <Field {...f("Shop ID", "yukassaShopId", { placeholder: "Идентификатор магазина" })} />
              <Field {...f("Secret Key", "yukassaSecretKey", { type: "password", placeholder: "Секретный ключ" })} />
              <p className="text-xs font-medium text-gray-500 pt-2">CryptoPay</p>
              <Field {...f("API Token", "cryptopayToken", { type: "password", placeholder: "Токен CryptoPay" })} />
              <ToggleField {...t("Telegram Stars", "starsEnabled", "Принимать оплату через Telegram Stars")} />
            </div>
          )}

          {/* === Email === */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-xs">
                SMTP для рассылок и email-уведомлений. Можно пропустить.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field {...f("SMTP хост", "smtpHost", { placeholder: "smtp.gmail.com" })} />
                <Field {...f("Порт", "smtpPort", { placeholder: "587" })} />
              </div>
              <Field {...f("Логин", "smtpUser", { placeholder: "user@example.com" })} />
              <Field {...f("Пароль", "smtpPass", { type: "password", placeholder: "Пароль или App Password" })} />
              <Field {...f("Отправитель (From)", "smtpFrom", { placeholder: "noreply@example.com" })} />
            </div>
          )}

          {/* === Рефералы === */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-xs">
                Реферальная программа. Пользователи получают бонусные дни за приглашённых друзей.
              </div>
              <ToggleField {...t("Включить реферальную программу", "referralEnabled")} />
              {form.referralEnabled === 'true' && (
                <>
                  <Field {...f("Бонусные дни за реферала", "referralBonusDays", { type: "number", placeholder: "30" })} />
                  <Field {...f("Мин. дней подписки у реферала", "referralMinDays", { type: "number", placeholder: "30", hint: "Реферал должен иметь подписку не менее N дней чтобы бонус начислился" })} />
                </>
              )}
            </div>
          )}

          {/* === Бухгалтерия === */}
          {step === 7 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-xs">
                Настройте начальный баланс, категории и постоянные расходы. Всё можно изменить позже.
              </div>

              <Field {...f("Текущий остаток на счёте (₽)", "startingBalance", { type: "number", placeholder: "0", hint: "Сумма на вашем основном счёте прямо сейчас" })} />

              <ToggleField {...t("Создать стандартные категории", "defaultCategories", "Серверы, Реклама, Зарплаты, Подписки, Оплата VPN, Рефералы")} />

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Стандартные категории:</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" />Оплата VPN</div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" />Рефералы</div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-teal-500" />Прочие доходы</div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" />Серверы</div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500" />Реклама</div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500" />Зарплаты</div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-pink-500" />Подписки</div>
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-gray-500" />Прочие расходы</div>
                </div>
              </div>

              {/* Custom categories */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Свои категории (необязательно):</p>
                {customCats.map((c, i) => (
                  <div key={i} className="flex gap-2 mb-2 items-center">
                    <input value={c.name} onChange={e => { const n = [...customCats]; n[i].name = e.target.value; setCustomCats(n) }} className="input flex-1" placeholder="Название" />
                    <select value={c.type} onChange={e => { const n = [...customCats]; n[i].type = e.target.value; setCustomCats(n) }} className="input w-28 bg-white">
                      <option value="EXPENSE">Расход</option>
                      <option value="INCOME">Доход</option>
                    </select>
                    <button onClick={() => setCustomCats(customCats.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs px-2">x</button>
                  </div>
                ))}
                <button onClick={() => setCustomCats([...customCats, { name: '', type: 'EXPENSE', color: '#6B7280' }])}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Добавить категорию</button>
              </div>

              {/* Recurring expenses */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Постоянные расходы (необязательно):</p>
                {recurringExpenses.map((r, i) => (
                  <div key={i} className="flex gap-2 mb-2 items-center">
                    <input value={r.name} onChange={e => { const n = [...recurringExpenses]; n[i].name = e.target.value; setRecurringExpenses(n) }} className="input flex-1" placeholder="Название (VPS, домен...)" />
                    <input value={r.amount} onChange={e => { const n = [...recurringExpenses]; n[i].amount = e.target.value; setRecurringExpenses(n) }} className="input w-24" type="number" placeholder="Сумма" />
                    <input value={r.paymentDay} onChange={e => { const n = [...recurringExpenses]; n[i].paymentDay = e.target.value; setRecurringExpenses(n) }} className="input w-16" type="number" placeholder="День" min="1" max="31" />
                    <button onClick={() => setRecurringExpenses(recurringExpenses.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs px-2">x</button>
                  </div>
                ))}
                <button onClick={() => setRecurringExpenses([...recurringExpenses, { name: '', amount: '', paymentDay: '1' }])}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Добавить расход</button>
              </div>
            </div>
          )}

          {/* === Импорт данных === */}
          {step === 8 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-xs">
                Загрузите данные из Excel для быстрого старта. Скачайте шаблоны, заполните и загрузите обратно.
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Финансы */}
                <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary-600" />
                    <span className="text-sm font-medium">Финансы</span>
                  </div>
                  <button onClick={() => downloadTemplate('transactions')}
                    className="w-full bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-gray-100 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Скачать шаблон
                  </button>
                  <button onClick={() => importExcel('transactions')} disabled={importLoading.transactions}
                    className="w-full bg-primary-50 text-primary-700 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-primary-100 transition-colors disabled:opacity-50">
                    {importLoading.transactions ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Загрузить файл
                  </button>
                  {importResults.transactions && (
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle className="w-3 h-3" /> Импортировано: {importResults.transactions.imported}
                      </div>
                      {importResults.transactions.errors?.length ? (
                        <div className="text-red-500">Ошибки: {importResults.transactions.errors.length}</div>
                      ) : null}
                    </div>
                  )}
                </div>
                {/* Пользователи */}
                <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary-600" />
                    <span className="text-sm font-medium">Пользователи</span>
                  </div>
                  <button onClick={() => downloadTemplate('users')}
                    className="w-full bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-gray-100 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Скачать шаблон
                  </button>
                  <button onClick={() => importExcel('users')} disabled={importLoading.users}
                    className="w-full bg-primary-50 text-primary-700 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-primary-100 transition-colors disabled:opacity-50">
                    {importLoading.users ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Загрузить файл
                  </button>
                  {importResults.users && (
                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle className="w-3 h-3" /> Импортировано: {importResults.users.imported}
                      </div>
                      {importResults.users.errors?.length ? (
                        <div className="text-red-500">Ошибки: {importResults.users.errors.length}</div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* === Серверы === */}
          {step === 9 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-xs">
                Добавьте серверы (VPS, хостинг) для учёта расходов и мониторинга оплат.
              </div>
              {servers.map((s, i) => (
                <div key={i} className="rounded-lg bg-gray-50 p-3 space-y-2">
                  <div className="flex gap-2">
                    <input value={s.name} onChange={e => { const n = [...servers]; n[i].name = e.target.value; setServers(n) }} className="input flex-1" placeholder="Название (Frankfurt-1)" />
                    <button onClick={() => setServers(servers.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs px-2">x</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={s.provider} onChange={e => { const n = [...servers]; n[i].provider = e.target.value; setServers(n) }} className="input" placeholder="Провайдер (Hetzner)" />
                    <input value={s.ip} onChange={e => { const n = [...servers]; n[i].ip = e.target.value; setServers(n) }} className="input" placeholder="IP адрес" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={s.monthlyCost} onChange={e => { const n = [...servers]; n[i].monthlyCost = e.target.value; setServers(n) }} className="input" type="number" placeholder="Стоимость/мес" />
                    <select value={s.currency} onChange={e => { const n = [...servers]; n[i].currency = e.target.value; setServers(n) }} className="input bg-white">
                      <option value="RUB">RUB</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
              ))}
              <button onClick={() => setServers([...servers, { name: '', provider: '', ip: '', monthlyCost: '', currency: 'RUB' }])}
                className="w-full py-2 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-primary-300 hover:text-primary-600 transition-colors">
                + Добавить сервер
              </button>
            </div>
          )}

          {/* === Партнёры === */}
          {step === 10 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-xs">
                Добавьте партнёров и инвесторов для учёта долей и выплат.
              </div>
              {partners.map((p, i) => (
                <div key={i} className="rounded-lg bg-gray-50 p-3 space-y-2">
                  <div className="flex gap-2">
                    <input value={p.name} onChange={e => { const n = [...partners]; n[i].name = e.target.value; setPartners(n) }} className="input flex-1" placeholder="Имя партнёра" />
                    <button onClick={() => setPartners(partners.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs px-2">x</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={p.role} onChange={e => { const n = [...partners]; n[i].role = e.target.value; setPartners(n) }} className="input" placeholder="Роль (инвестор)" />
                    <input value={p.share} onChange={e => { const n = [...partners]; n[i].share = e.target.value; setPartners(n) }} className="input" type="number" placeholder="Доля %" />
                    <input value={p.contact} onChange={e => { const n = [...partners]; n[i].contact = e.target.value; setPartners(n) }} className="input" placeholder="Контакт (@tg)" />
                  </div>
                </div>
              ))}
              <button onClick={() => setPartners([...partners, { name: '', role: '', share: '', contact: '' }])}
                className="w-full py-2 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-primary-300 hover:text-primary-600 transition-colors">
                + Добавить партнёра
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <button onClick={back} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Назад
              </button>
            )}
            <button onClick={saveStep}
              disabled={loading || (step === 0 && !form.companyName)}
              className="bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-1.5 flex-1 justify-center disabled:opacity-50 hover:bg-primary-700">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {step < STEPS.length - 1 ? 'Далее' : 'Завершить настройку'}
              {!loading && step < STEPS.length - 1 && <ChevronRight className="w-4 h-4" />}
            </button>
            {SKIP_ALLOWED.has(STEPS[step].id) && (
              <button onClick={skip} className="px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <SkipForward className="w-4 h-4" /> Пропустить
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Все настройки можно изменить позже в разделе Настройки
        </p>
      </div>
    </div>
  )
}
