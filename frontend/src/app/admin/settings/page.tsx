'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Save, Loader2, Settings, Shield, Globe, MessageCircle, CreditCard,
  Mail, Users, Bell, Palette, ChevronDown, Plus, Trash2, UserPlus, RotateCcw,
} from 'lucide-react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'

/* ── Types ─────────────────────────────────────── */

type TabId = 'general' | 'vpn' | 'bot' | 'payments' | 'email' | 'referral' | 'notifications' | 'lk'

const TABS: { id: TabId; icon: any; label: string }[] = [
  { id: 'general',       icon: Settings,       label: 'Основные' },
  { id: 'vpn',           icon: Shield,         label: 'VPN' },
  { id: 'bot',           icon: MessageCircle,  label: 'Бот' },
  { id: 'payments',      icon: CreditCard,     label: 'Платежи' },
  { id: 'email',         icon: Mail,           label: 'Email' },
  { id: 'referral',      icon: Users,          label: 'Рефералы' },
  { id: 'notifications', icon: Bell,           label: 'Уведомления' },
  { id: 'lk',            icon: Palette,        label: 'Личный кабинет' },
]

/* ── Component ─────────────────────────────────── */

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [dirty, setDirty]       = useState(false)
  const [tab, setTab]           = useState<TabId>('general')

  const load = useCallback(async () => {
    try { setSettings(await api.settings()) } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const upd = (key: string, val: string) => {
    setSettings(s => ({ ...s, [key]: val }))
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.updateSettings(settings)
      toast.success('Настройки сохранены')
      setDirty(false)
    } catch { toast.error('Ошибка сохранения') }
    setSaving(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
    </div>
  )

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Настройки</h1>
        <button onClick={save} disabled={saving || !dirty}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Сохранить
        </button>
      </div>

      <div className="page-content">
        <div className="flex gap-6">
          {/* Sidebar tabs */}
          <div className="w-48 flex-shrink-0 space-y-0.5">
            {TABS.map(t => {
              const Icon = t.icon
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-all ${
                    tab === t.id ? 'bg-primary-50 text-primary-600 font-medium' : 'text-gray-500 hover:bg-gray-50'
                  }`}>
                  <Icon className="w-4 h-4" /> {t.label}
                </button>
              )
            })}
          </div>

          {/* Content area */}
          <div className="flex-1 bg-white rounded-xl border border-gray-100 p-6 space-y-5">

            {/* ── General ── */}
            {tab === 'general' && (
              <>
                <SectionTitle>Основные настройки</SectionTitle>
                <Field label="Название проекта" value={settings.company_name} onChange={v => upd('company_name', v)} placeholder="HIDEYOU PRO" />
                <Field label="Валюта по умолчанию" value={settings.currency || 'RUB'} onChange={v => upd('currency', v)} />
                <Field label="Ссылка на поддержку" value={settings.support_url} onChange={v => upd('support_url', v)} placeholder="https://t.me/support" />
                <Field label="Telegram-канал" value={settings.tg_channel} onChange={v => upd('tg_channel', v)} placeholder="https://t.me/channel" />
                <FieldTextarea label="Приветственное сообщение" value={settings.welcome_message} onChange={v => upd('welcome_message', v)} placeholder="Текст для новых пользователей..." hint="Показывается при первом входе" />
                <Toggle label="Режим обслуживания" hint="Блокирует новые регистрации и покупки" checked={settings.maintenance_mode === 'true'} onChange={v => upd('maintenance_mode', String(v))} />
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2">Мастер настройки</p>
                  <button onClick={async () => {
                    if (!confirm('Перезапустить мастер настройки? Текущие настройки сохранятся.')) return
                    await api.updateSettings({ setup_complete: 'false' })
                    window.location.href = '/setup'
                  }} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" /> Перезапустить Wizard
                  </button>
                </div>
              </>
            )}

            {/* ── VPN ── */}
            {tab === 'vpn' && (
              <>
                <SectionTitle>REMNAWAVE</SectionTitle>
                <Field label="URL панели" value={settings.remnawave_url} onChange={v => upd('remnawave_url', v)} placeholder="https://panel.example.com" />
                <Field label="API токен" value={settings.remnawave_token} onChange={v => upd('remnawave_token', v)} type="password" />
                <div className="p-3 rounded-lg bg-gray-50 text-xs">
                  {settings.remnawave_configured === 'true'
                    ? <span className="text-green-700 font-medium">Подключено</span>
                    : <span className="text-yellow-700 font-medium">Не настроено</span>
                  }
                </div>
                <SectionTitle>Пробный период</SectionTitle>
                <Toggle label="Включить пробный период" checked={settings.trial_enabled === 'true'} onChange={v => upd('trial_enabled', String(v))} />
                <Field label="Длительность пробного (дней)" value={settings.trial_days || '3'} onChange={v => upd('trial_days', v)} type="number" />
              </>
            )}

            {/* ── Bot ── */}
            {tab === 'bot' && (
              <>
                <SectionTitle>Telegram Bot</SectionTitle>
                <Field label="Bot Token" value={settings.bot_token} onChange={v => upd('bot_token', v)} type="password" />
                <Field label="Bot Username" value={settings.bot_name} onChange={v => upd('bot_name', v)} placeholder="@mybot" />
                <Field label="Webapp URL" value={settings.bot_webapp_url} onChange={v => upd('bot_webapp_url', v)} placeholder="https://app.example.com" hint="URL MiniApp для кнопки в боте" />
                <SectionTitle>Сообщения бота</SectionTitle>
                <FieldTextarea label="Приветственное сообщение /start" value={settings.bot_welcome_text} onChange={v => upd('bot_welcome_text', v)} placeholder="Добро пожаловать!" />
                <FieldTextarea label="Текст при отсутствии подписки" value={settings.bot_no_sub_text} onChange={v => upd('bot_no_sub_text', v)} placeholder="У вас нет активной подписки" />
              </>
            )}

            {/* ── Payments ── */}
            {tab === 'payments' && (
              <>
                <SectionTitle>ЮKassa</SectionTitle>
                <Field label="Shop ID" value={settings.yukassa_shop_id} onChange={v => upd('yukassa_shop_id', v)} />
                <Field label="Secret Key" value={settings.yukassa_secret_key} onChange={v => upd('yukassa_secret_key', v)} type="password" />
                <SectionTitle>CryptoPay</SectionTitle>
                <Field label="API Token" value={settings.cryptopay_token} onChange={v => upd('cryptopay_token', v)} type="password" />
                <SectionTitle>Telegram Stars</SectionTitle>
                <Toggle label="Принимать Telegram Stars" checked={settings.stars_enabled === 'true'} onChange={v => upd('stars_enabled', String(v))} />
                <Field label="Курс Stars к RUB" value={settings.stars_rate || '1.5'} onChange={v => upd('stars_rate', v)} type="number" hint="1 Star = X рублей" />
                <SectionTitle>Общие</SectionTitle>
                <Toggle label="Автоматическое продление" hint="Автопродление подписки при наличии баланса" checked={settings.auto_renewal === 'true'} onChange={v => upd('auto_renewal', String(v))} />
              </>
            )}

            {/* ── Email ── */}
            {tab === 'email' && (
              <>
                <SectionTitle>SMTP</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Host" value={settings.smtp_host} onChange={v => upd('smtp_host', v)} placeholder="smtp.yandex.ru" />
                  <Field label="Port" value={settings.smtp_port || '587'} onChange={v => upd('smtp_port', v)} />
                </div>
                <Field label="User" value={settings.smtp_user} onChange={v => upd('smtp_user', v)} placeholder="noreply@example.com" />
                <Field label="Password" value={settings.smtp_pass} onChange={v => upd('smtp_pass', v)} type="password" />
                <Field label="From" value={settings.smtp_from} onChange={v => upd('smtp_from', v)} placeholder="noreply@example.com" />
                <SectionTitle>Шаблоны писем</SectionTitle>
                <EmailTemplates settings={settings} upd={upd} />
              </>
            )}

            {/* ── Referral ── */}
            {tab === 'referral' && (
              <>
                <SectionTitle>Реферальная программа</SectionTitle>
                <Toggle label="Реферальная программа включена" checked={settings.referral_enabled !== 'false'} onChange={v => upd('referral_enabled', String(v))} />
                <Field label="Бонусные дни за реферала" value={settings.referral_bonus_days || '30'} onChange={v => upd('referral_bonus_days', v)} type="number" />
                <Field label="Мин. дней подписки для бонуса" value={settings.referral_min_days || '30'} onChange={v => upd('referral_min_days', v)} type="number" />
                <Field label="Бонус рефереру (₽)" value={settings.referral_bonus_rub || '0'} onChange={v => upd('referral_bonus_rub', v)} type="number" hint="Денежный бонус рефереру на баланс" />
                <Field label="Бонус рефералу (₽)" value={settings.referral_invitee_bonus_rub || '0'} onChange={v => upd('referral_invitee_bonus_rub', v)} type="number" hint="Денежный бонус приглашённому на баланс" />
              </>
            )}

            {/* ── Notifications ── */}
            {tab === 'notifications' && (
              <>
                <SectionTitle>Telegram-каналы уведомлений</SectionTitle>
                <p className="text-xs text-gray-400 mb-3">Уведомления о событиях (платежи, новые пользователи, серверы) в Telegram-каналы или группы.</p>
                <Field label="Chat ID для уведомлений о платежах" value={settings.notify_payments_chat_id} onChange={v => upd('notify_payments_chat_id', v)} placeholder="-1001234567890" />
                <Field label="Chat ID для уведомлений о новых пользователях" value={settings.notify_users_chat_id} onChange={v => upd('notify_users_chat_id', v)} placeholder="-1001234567890" />
                <Field label="Chat ID для алертов серверов" value={settings.notify_servers_chat_id} onChange={v => upd('notify_servers_chat_id', v)} placeholder="-1001234567890" />
                <SectionTitle>Email-уведомления</SectionTitle>
                <Toggle label="Отправлять email при оплате" checked={settings.email_on_payment === 'true'} onChange={v => upd('email_on_payment', String(v))} />
                <Toggle label="Отправлять email при истечении подписки" checked={settings.email_on_expiry === 'true'} onChange={v => upd('email_on_expiry', String(v))} />
                <Field label="За сколько дней до истечения" value={settings.expiry_notify_days || '3'} onChange={v => upd('expiry_notify_days', v)} type="number" />
              </>
            )}

            {/* ── LK (personal account) ── */}
            {tab === 'lk' && (
              <>
                <SectionTitle>Личный кабинет</SectionTitle>
                <p className="text-xs text-gray-400 mb-3">Настройки внешнего вида личного кабинета пользователя.</p>
                <SectionTitle>Домены и URL</SectionTitle>
                <Field label="LK домен" value={settings.lk_domain} onChange={v => upd('lk_domain', v)} placeholder="lk.example.com" hint="Домен личного кабинета пользователя" />
                <Field label="LK URL" value={settings.lk_url} onChange={v => upd('lk_url', v)} placeholder="https://lk.example.com" hint="Автоматически генерируется из домена" />
                <Field label="Webhook домен" value={settings.webhook_domain} onChange={v => upd('webhook_domain', v)} placeholder="api.example.com" hint="Домен для API и вебхуков" />
                <Field label="MiniApp URL" value={settings.miniapp_url} onChange={v => upd('miniapp_url', v)} placeholder="https://miniapp.example.com" hint="URL Telegram MiniApp" />
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-800 space-y-1">
                  <p className="font-medium">После сохранения доменов:</p>
                  <p>Зайдите на сервер и выполните команду:</p>
                  <code className="block bg-amber-100 rounded px-2 py-1 font-mono text-amber-900">
                    bash /root/hideyoupro/scripts/setup-domains.sh
                  </code>
                  <p>Или через CLI: <code className="bg-amber-100 rounded px-1 font-mono">./hyp domains</code></p>
                  <p>Скрипт автоматически получит SSL сертификаты и настроит nginx.</p>
                </div>
                <SectionTitle>Брендинг</SectionTitle>
                <Field label="Логотип URL" value={settings.lk_logo_url} onChange={v => upd('lk_logo_url', v)} placeholder="https://example.com/logo.png" hint="URL логотипа для шапки ЛК" />
                <Field label="Favicon URL" value={settings.lk_favicon_url} onChange={v => upd('lk_favicon_url', v)} placeholder="https://example.com/favicon.ico" />
                <SectionTitle>Цвета</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Основной цвет</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={settings.lk_primary_color || '#6366f1'} onChange={e => upd('lk_primary_color', e.target.value)} className="w-10 h-8 rounded cursor-pointer border border-gray-200" />
                      <input value={settings.lk_primary_color || '#6366f1'} onChange={e => upd('lk_primary_color', e.target.value)} className="input flex-1 font-mono text-xs" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Акцентный цвет</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={settings.lk_accent_color || '#10b981'} onChange={e => upd('lk_accent_color', e.target.value)} className="w-10 h-8 rounded cursor-pointer border border-gray-200" />
                      <input value={settings.lk_accent_color || '#10b981'} onChange={e => upd('lk_accent_color', e.target.value)} className="input flex-1 font-mono text-xs" />
                    </div>
                  </div>
                </div>
                <SectionTitle>Тексты</SectionTitle>
                <FieldTextarea label="Текст в подвале" value={settings.lk_footer_text} onChange={v => upd('lk_footer_text', v)} placeholder="(c) 2024 HIDEYOU PRO" />
                <Field label="Ссылка на поддержку в ЛК" value={settings.lk_support_url} onChange={v => upd('lk_support_url', v)} placeholder="https://t.me/support" />
                <Field label="Ссылка на Telegram-канал" value={settings.lk_channel_url} onChange={v => upd('lk_channel_url', v)} placeholder="https://t.me/channel" />
                <Field label="Документы / Оферта URL" value={settings.lk_terms_url} onChange={v => upd('lk_terms_url', v)} placeholder="https://example.com/terms" />
                <Toggle label="Показывать баланс" hint="Отображать баланс пользователя в ЛК" checked={settings.lk_show_balance !== 'false'} onChange={v => upd('lk_show_balance', String(v))} />
                <Toggle label="Показывать реферальную программу" checked={settings.lk_show_referral !== 'false'} onChange={v => upd('lk_show_referral', String(v))} />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* ── Shared components ─────────────────────────── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium text-gray-900 pt-2 first:pt-0">{children}</h3>
}

function Field({ label, value, onChange, type = 'text', placeholder, hint }: {
  label: string; value?: string; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} className="input" placeholder={placeholder} />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function FieldTextarea({ label, value, onChange, placeholder, hint }: {
  label: string; value?: string; onChange: (v: string) => void; placeholder?: string; hint?: string
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} className="input min-h-[80px] resize-y" placeholder={placeholder} />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <p className="text-sm text-gray-900">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <button onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-primary-600' : 'bg-gray-200'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

/* ── Email Templates ───────────────────────────── */

const EMAIL_TEMPLATES = [
  { key: 'email_tpl_welcome',      label: 'Приветственное письмо',   desc: 'При регистрации', vars: ['{appUrl}'] },
  { key: 'email_tpl_payment',      label: 'Успешная оплата',         desc: 'После подтверждения платежа', vars: ['{tariffName}', '{expireAt}', '{appUrl}'] },
  { key: 'email_tpl_expiry',       label: 'Подписка истекает',       desc: 'За несколько дней до конца', vars: ['{daysLeft}', '{appUrl}'] },
  { key: 'email_tpl_verification', label: 'Код подтверждения',       desc: 'При регистрации/смене email', vars: ['{code}'] },
  { key: 'email_tpl_gift',         label: 'Подарочная подписка',     desc: 'Получателю подарка', vars: ['{senderName}', '{tariffName}', '{giftCode}', '{appUrl}'] },
  { key: 'email_tpl_reset',        label: 'Сброс пароля',            desc: 'При запросе сброса', vars: ['{code}'] },
]

function EmailTemplates({ settings, upd }: { settings: Record<string, string>; upd: (k: string, v: string) => void }) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  return (
    <div className="space-y-1">
      {EMAIL_TEMPLATES.map(tpl => {
        const isOpen = openKey === tpl.key
        const hasValue = !!(settings[tpl.key]?.trim())
        return (
          <div key={tpl.key} className="rounded-lg border border-gray-100 overflow-hidden">
            <button onClick={() => setOpenKey(isOpen ? null : tpl.key)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">{tpl.label}</span>
                {hasValue && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700">Настроен</span>}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="px-3 pb-3 space-y-2">
                <p className="text-xs text-gray-400">{tpl.desc}</p>
                <div className="flex flex-wrap gap-1">
                  {tpl.vars.map(v => (
                    <span key={v} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-gray-50 border border-gray-100">
                      <code className="text-primary-600">{v}</code>
                    </span>
                  ))}
                </div>
                <textarea
                  className="input text-xs font-mono w-full min-h-[80px]"
                  value={settings[tpl.key] || ''}
                  onChange={e => upd(tpl.key, e.target.value)}
                  placeholder="HTML шаблон..."
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
