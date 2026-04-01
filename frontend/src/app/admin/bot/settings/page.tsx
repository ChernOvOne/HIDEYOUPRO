'use client'

import { useEffect, useState } from 'react'
import {
  Save, RefreshCw, Loader2, MessageSquare, Mouse, Link2,
  ToggleLeft, Eye, EyeOff, Settings,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ── Types ─────────────────────────────────────────────────── */

interface BotSettings {
  bot_token: string
  bot_start_text: string
  bot_subscription_active: string
  bot_subscription_inactive: string
  bot_tariff_header: string
  bot_promo_prompt: string
  bot_promo_success: string
  bot_btn_subscription: string
  bot_btn_tariffs: string
  bot_btn_referral: string
  bot_btn_balance: string
  bot_btn_promo: string
  bot_btn_devices: string
  bot_btn_instructions: string
  bot_btn_open_lk: string
  bot_support_url: string
  bot_channel_url: string
  bot_feature_promo: string
  bot_feature_devices: string
  bot_feature_instructions: string
  bot_feature_balance: string
  bot_feature_referrals: string
  [key: string]: string
}

const DEFAULTS: BotSettings = {
  bot_token: '',
  bot_start_text: 'Добро пожаловать! Я бот HIDEYOU VPN.',
  bot_subscription_active: 'Ваша подписка активна.',
  bot_subscription_inactive: 'У вас нет активной подписки.',
  bot_tariff_header: 'Выберите тариф:',
  bot_promo_prompt: 'Введите промокод:',
  bot_promo_success: 'Промокод активирован!',
  bot_btn_subscription: 'Подписка',
  bot_btn_tariffs: 'Тарифы',
  bot_btn_referral: 'Рефералы',
  bot_btn_balance: 'Баланс',
  bot_btn_promo: 'Промокод',
  bot_btn_devices: 'Устройства',
  bot_btn_instructions: 'Инструкции',
  bot_btn_open_lk: 'Открыть ЛК',
  bot_support_url: '',
  bot_channel_url: '',
  bot_feature_promo: 'true',
  bot_feature_devices: 'true',
  bot_feature_instructions: 'true',
  bot_feature_balance: 'true',
  bot_feature_referrals: 'true',
}

/* ── Section configs ───────────────────────────────────────── */

type FieldDef =
  | { key: string; label: string; type: 'textarea'; placeholder?: string }
  | { key: string; label: string; type: 'text'; placeholder?: string }
  | { key: string; label: string; type: 'url'; placeholder?: string }
  | { key: string; label: string; type: 'toggle' }
  | { key: string; label: string; type: 'token' }

interface Section {
  id: string
  icon: any
  title: string
  description: string
  fields: FieldDef[]
}

const SECTIONS: Section[] = [
  {
    id: 'token', icon: Settings, title: 'Токен бота', description: 'Telegram Bot API токен',
    fields: [
      { key: 'bot_token', label: 'Токен бота', type: 'token' },
    ],
  },
  {
    id: 'messages', icon: MessageSquare, title: 'Тексты сообщений', description: 'Настройте сообщения бота для пользователей',
    fields: [
      { key: 'bot_start_text', label: 'Приветственное сообщение', type: 'textarea', placeholder: 'Текст при запуске бота...' },
      { key: 'bot_subscription_active', label: 'Подписка активна', type: 'textarea', placeholder: 'Текст при активной подписке...' },
      { key: 'bot_subscription_inactive', label: 'Нет подписки', type: 'textarea', placeholder: 'Текст без активной подписки...' },
      { key: 'bot_tariff_header', label: 'Заголовок тарифов', type: 'textarea', placeholder: 'Заголовок списка тарифов...' },
      { key: 'bot_promo_prompt', label: 'Запрос промокода', type: 'textarea', placeholder: 'Текст запроса промокода...' },
      { key: 'bot_promo_success', label: 'Промокод применён', type: 'textarea', placeholder: 'Сообщение после применения промокода...' },
    ],
  },
  {
    id: 'buttons', icon: Mouse, title: 'Кнопки меню', description: 'Настройте надписи кнопок главного меню',
    fields: [
      { key: 'bot_btn_subscription', label: 'Подписка', type: 'text', placeholder: 'Подписка' },
      { key: 'bot_btn_tariffs', label: 'Тарифы', type: 'text', placeholder: 'Тарифы' },
      { key: 'bot_btn_referral', label: 'Рефералы', type: 'text', placeholder: 'Рефералы' },
      { key: 'bot_btn_balance', label: 'Баланс', type: 'text', placeholder: 'Баланс' },
      { key: 'bot_btn_promo', label: 'Промокод', type: 'text', placeholder: 'Промокод' },
      { key: 'bot_btn_devices', label: 'Устройства', type: 'text', placeholder: 'Устройства' },
      { key: 'bot_btn_instructions', label: 'Инструкции', type: 'text', placeholder: 'Инструкции' },
      { key: 'bot_btn_open_lk', label: 'Открыть ЛК', type: 'text', placeholder: 'Открыть ЛК' },
    ],
  },
  {
    id: 'links', icon: Link2, title: 'Ссылки', description: 'URL поддержки и канала',
    fields: [
      { key: 'bot_support_url', label: 'Ссылка на поддержку', type: 'url', placeholder: 'https://t.me/support' },
      { key: 'bot_channel_url', label: 'Telegram канал', type: 'url', placeholder: 'https://t.me/channel' },
    ],
  },
  {
    id: 'toggles', icon: ToggleLeft, title: 'Переключатели функций', description: 'Включение/отключение функций бота',
    fields: [
      { key: 'bot_feature_referrals', label: 'Рефералы', type: 'toggle' },
      { key: 'bot_feature_promo', label: 'Промокоды', type: 'toggle' },
      { key: 'bot_feature_devices', label: 'Устройства', type: 'toggle' },
      { key: 'bot_feature_instructions', label: 'Инструкции', type: 'toggle' },
      { key: 'bot_feature_balance', label: 'Баланс', type: 'toggle' },
    ],
  },
]

/* ── Toggle component ──────────────────────────────────────── */

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
        checked ? 'bg-primary-600' : 'bg-gray-200'
      }`}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  )
}

/* ── Page ───────────────────────────────────────────────────── */

export default function BotSettingsPage() {
  const [settings, setSettings] = useState<BotSettings>(DEFAULTS)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [dirty, setDirty]       = useState(false)
  const [tokenVisible, setTokenVisible] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => { setSettings({ ...DEFAULTS, ...d }); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const update = (key: string, value: string) => {
    setSettings(s => ({ ...s, [key]: value }))
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error()
      toast.success('Настройки бота сохранены')
      setDirty(false)
    } catch {
      toast.error('Ошибка сохранения настроек')
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings', { credentials: 'include' })
      if (!res.ok) throw new Error()
      const d = await res.json()
      setSettings({ ...DEFAULTS, ...d })
    } catch { /* keep defaults */ }
    setLoading(false)
    setDirty(false)
  }

  const maskToken = (t: string) => {
    if (!t) return '---'
    if (t.length <= 10) return t
    return t.slice(0, 5) + '***' + t.slice(-4)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Настройки бота</h1>
          <p className="page-subtitle">Сообщения, кнопки и переключатели функций</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Сбросить
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="max-w-3xl space-y-5">
          {SECTIONS.map(section => {
            const Icon = section.icon
            return (
              <div key={section.id} className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center">
                    <Icon className="w-[18px] h-[18px] text-primary-600" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">{section.title}</h2>
                    <p className="text-xs text-gray-400">{section.description}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {section.fields.map(field => {
                    if (field.type === 'token') {
                      return (
                        <div key={field.key}>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">{field.label}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type={tokenVisible ? 'text' : 'password'}
                              value={tokenVisible ? (settings[field.key] || '') : maskToken(settings[field.key] || '')}
                              onChange={e => update(field.key, e.target.value)}
                              readOnly={!tokenVisible}
                              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white font-mono focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
                            />
                            <button
                              onClick={() => setTokenVisible(!tokenVisible)}
                              className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                              {tokenVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      )
                    }

                    if (field.type === 'toggle') {
                      return (
                        <div key={field.key} className="flex items-center justify-between py-1.5">
                          <span className="text-sm text-gray-700">{field.label}</span>
                          <ToggleSwitch
                            checked={settings[field.key] === 'true'}
                            onChange={v => update(field.key, v ? 'true' : 'false')}
                          />
                        </div>
                      )
                    }

                    if (field.type === 'textarea') {
                      return (
                        <div key={field.key}>
                          <label className="block text-xs font-medium text-gray-500 mb-1.5">{field.label}</label>
                          <textarea
                            rows={3}
                            value={settings[field.key] || ''}
                            onChange={e => update(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white resize-y min-h-[72px] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
                          />
                        </div>
                      )
                    }

                    return (
                      <div key={field.key}>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">{field.label}</label>
                        <input
                          type={field.type === 'url' ? 'url' : 'text'}
                          value={settings[field.key] || ''}
                          onChange={e => update(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
