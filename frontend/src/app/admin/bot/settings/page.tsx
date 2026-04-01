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
  bot_start_text: 'Welcome! I am the HIDEYOU VPN bot.',
  bot_subscription_active: 'Your subscription is active.',
  bot_subscription_inactive: 'You have no active subscription.',
  bot_tariff_header: 'Choose a plan:',
  bot_promo_prompt: 'Enter a promo code:',
  bot_promo_success: 'Promo code activated!',
  bot_btn_subscription: 'Subscription',
  bot_btn_tariffs: 'Plans',
  bot_btn_referral: 'Referrals',
  bot_btn_balance: 'Balance',
  bot_btn_promo: 'Promo code',
  bot_btn_devices: 'Devices',
  bot_btn_instructions: 'Instructions',
  bot_btn_open_lk: 'Open Dashboard',
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
    id: 'token', icon: Settings, title: 'Bot Token', description: 'Telegram Bot API token',
    fields: [
      { key: 'bot_token', label: 'Bot Token', type: 'token' },
    ],
  },
  {
    id: 'messages', icon: MessageSquare, title: 'Message Texts', description: 'Customize bot messages sent to users',
    fields: [
      { key: 'bot_start_text', label: 'Welcome message', type: 'textarea', placeholder: 'Welcome text when user starts the bot...' },
      { key: 'bot_subscription_active', label: 'Subscription active', type: 'textarea', placeholder: 'Text for active subscription...' },
      { key: 'bot_subscription_inactive', label: 'No subscription', type: 'textarea', placeholder: 'Text when no active subscription...' },
      { key: 'bot_tariff_header', label: 'Tariff header', type: 'textarea', placeholder: 'Header for tariff list...' },
      { key: 'bot_promo_prompt', label: 'Promo code prompt', type: 'textarea', placeholder: 'Text asking for promo code...' },
      { key: 'bot_promo_success', label: 'Promo code success', type: 'textarea', placeholder: 'Success message after promo code...' },
    ],
  },
  {
    id: 'buttons', icon: Mouse, title: 'Menu Buttons', description: 'Customize main menu button labels',
    fields: [
      { key: 'bot_btn_subscription', label: 'Subscription', type: 'text', placeholder: 'Subscription' },
      { key: 'bot_btn_tariffs', label: 'Plans', type: 'text', placeholder: 'Plans' },
      { key: 'bot_btn_referral', label: 'Referrals', type: 'text', placeholder: 'Referrals' },
      { key: 'bot_btn_balance', label: 'Balance', type: 'text', placeholder: 'Balance' },
      { key: 'bot_btn_promo', label: 'Promo code', type: 'text', placeholder: 'Promo code' },
      { key: 'bot_btn_devices', label: 'Devices', type: 'text', placeholder: 'Devices' },
      { key: 'bot_btn_instructions', label: 'Instructions', type: 'text', placeholder: 'Instructions' },
      { key: 'bot_btn_open_lk', label: 'Open Dashboard', type: 'text', placeholder: 'Open Dashboard' },
    ],
  },
  {
    id: 'links', icon: Link2, title: 'Links', description: 'Support and channel URLs',
    fields: [
      { key: 'bot_support_url', label: 'Support link', type: 'url', placeholder: 'https://t.me/support' },
      { key: 'bot_channel_url', label: 'Telegram channel', type: 'url', placeholder: 'https://t.me/channel' },
    ],
  },
  {
    id: 'toggles', icon: ToggleLeft, title: 'Feature Toggles', description: 'Enable or disable bot features',
    fields: [
      { key: 'bot_feature_referrals', label: 'Referrals', type: 'toggle' },
      { key: 'bot_feature_promo', label: 'Promo codes', type: 'toggle' },
      { key: 'bot_feature_devices', label: 'Devices', type: 'toggle' },
      { key: 'bot_feature_instructions', label: 'Instructions', type: 'toggle' },
      { key: 'bot_feature_balance', label: 'Balance', type: 'toggle' },
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
      toast.success('Bot settings saved')
      setDirty(false)
    } catch {
      toast.error('Failed to save settings')
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
          <h1 className="page-title">Bot Settings</h1>
          <p className="page-subtitle">Messages, buttons, and feature toggles</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
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
