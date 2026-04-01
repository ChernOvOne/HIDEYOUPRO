'use client'

import { useEffect, useState, useCallback } from 'react'
import { Save, Loader2, Settings, Shield, Globe, MessageCircle, CreditCard, Mail, Users, Bell } from 'lucide-react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [tab, setTab]           = useState('general')

  const load = useCallback(async () => {
    try { setSettings(await api.settings()) } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const upd = (key: string, val: string) => setSettings(s => ({ ...s, [key]: val }))

  const save = async () => {
    setSaving(true)
    try {
      await api.updateSettings(settings)
      toast.success('Настройки сохранены')
    } catch { toast.error('Ошибка') }
    setSaving(false)
  }

  const TABS = [
    { id: 'general',  icon: Settings,       label: 'Основные' },
    { id: 'vpn',      icon: Shield,         label: 'VPN' },
    { id: 'notifications', icon: Bell,      label: 'Уведомления' },
    { id: 'telegram', icon: MessageCircle,  label: 'Telegram' },
    { id: 'payments', icon: CreditCard,     label: 'Платежи' },
    { id: 'email',    icon: Mail,           label: 'Email' },
    { id: 'referral', icon: Users,          label: 'Рефералы' },
  ]

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Настройки</h1>
        <button onClick={save} disabled={saving} className="btn-primary text-xs">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Сохранить
        </button>
      </div>

      <div className="page-content">
        <div className="flex gap-6">
          {/* Tabs */}
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

          {/* Content */}
          <div className="flex-1 card-p space-y-4">
            {tab === 'general' && (
              <>
                <h3 className="text-sm font-medium">Основные настройки</h3>
                <div><label className="text-xs text-gray-500 mb-1 block">Название проекта</label><input value={settings.company_name || ''} onChange={e => upd('company_name', e.target.value)} className="input" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Валюта</label><input value={settings.currency || 'RUB'} onChange={e => upd('currency', e.target.value)} className="input" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Ссылка на поддержку</label><input value={settings.support_url || ''} onChange={e => upd('support_url', e.target.value)} className="input" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Telegram-канал</label><input value={settings.tg_channel || ''} onChange={e => upd('tg_channel', e.target.value)} className="input" /></div>
              </>
            )}

            {tab === 'vpn' && (
              <>
                <h3 className="text-sm font-medium">REMNAWAVE</h3>
                <div><label className="text-xs text-gray-500 mb-1 block">URL панели</label><input value={settings.remnawave_url || ''} onChange={e => upd('remnawave_url', e.target.value)} className="input" placeholder="https://panel.example.com" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">API токен</label><input type="password" value={settings.remnawave_token || ''} onChange={e => upd('remnawave_token', e.target.value)} className="input" /></div>
                <div className="p-3 rounded-lg bg-gray-50 text-xs text-gray-400">
                  {settings.remnawave_configured === 'true' ? <span className="text-success-700">Подключено</span> : <span className="text-warn-700">Не настроено</span>}
                </div>
              </>
            )}

            {tab === 'telegram' && (
              <>
                <h3 className="text-sm font-medium">Telegram Bot</h3>
                <div><label className="text-xs text-gray-500 mb-1 block">Bot Token</label><input type="password" value={settings.bot_token || ''} onChange={e => upd('bot_token', e.target.value)} className="input" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Bot Username</label><input value={settings.bot_name || ''} onChange={e => upd('bot_name', e.target.value)} className="input" /></div>
              </>
            )}

            {tab === 'payments' && (
              <>
                <h3 className="text-sm font-medium">ЮKassa</h3>
                <div><label className="text-xs text-gray-500 mb-1 block">Shop ID</label><input value={settings.yukassa_shop_id || ''} onChange={e => upd('yukassa_shop_id', e.target.value)} className="input" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Secret Key</label><input type="password" value={settings.yukassa_secret_key || ''} onChange={e => upd('yukassa_secret_key', e.target.value)} className="input" /></div>
                <h3 className="text-sm font-medium pt-3">CryptoPay</h3>
                <div><label className="text-xs text-gray-500 mb-1 block">API Token</label><input type="password" value={settings.cryptopay_token || ''} onChange={e => upd('cryptopay_token', e.target.value)} className="input" /></div>
              </>
            )}

            {tab === 'email' && (
              <>
                <h3 className="text-sm font-medium">SMTP</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 mb-1 block">Host</label><input value={settings.smtp_host || ''} onChange={e => upd('smtp_host', e.target.value)} className="input" /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">Port</label><input value={settings.smtp_port || '587'} onChange={e => upd('smtp_port', e.target.value)} className="input" /></div>
                </div>
                <div><label className="text-xs text-gray-500 mb-1 block">User</label><input value={settings.smtp_user || ''} onChange={e => upd('smtp_user', e.target.value)} className="input" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Password</label><input type="password" value={settings.smtp_pass || ''} onChange={e => upd('smtp_pass', e.target.value)} className="input" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">From</label><input value={settings.smtp_from || ''} onChange={e => upd('smtp_from', e.target.value)} className="input" /></div>
              </>
            )}

            {tab === 'referral' && (
              <>
                <h3 className="text-sm font-medium">Реферальная программа</h3>
                <div><label className="text-xs text-gray-500 mb-1 block">Бонусные дни за реферала</label><input type="number" value={settings.referral_bonus_days || '30'} onChange={e => upd('referral_bonus_days', e.target.value)} className="input" /></div>
                <div><label className="text-xs text-gray-500 mb-1 block">Мин. дней подписки для бонуса</label><input type="number" value={settings.referral_min_days || '30'} onChange={e => upd('referral_min_days', e.target.value)} className="input" /></div>
              </>
            )}

            {tab === 'notifications' && (
              <>
                <h3 className="text-sm font-medium">Telegram-каналы уведомлений</h3>
                <p className="text-xs text-gray-400 mb-3">Отправляйте уведомления о событиях (доходы, расходы, оплаты, серверы) в Telegram-каналы или группы.</p>
                <div className="p-3 rounded-lg bg-gray-50 text-xs text-gray-400">
                  Управление каналами: API /api/admin/extras/notification-channels
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
