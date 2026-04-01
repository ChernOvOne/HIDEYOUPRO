'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Wifi, MessageCircle, CreditCard, CheckCircle2, ChevronRight, Loader2, SkipForward } from 'lucide-react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'

const STEPS = [
  { id: 'company',   icon: Building2,     title: 'Компания',     desc: 'Название, валюта, таймзона' },
  { id: 'remnawave', icon: Wifi,           title: 'REMNAWAVE',    desc: 'Подключение VPN-панели' },
  { id: 'telegram',  icon: MessageCircle, title: 'Telegram Bot', desc: 'Токен и username бота' },
  { id: 'payments',  icon: CreditCard,    title: 'Платежи',      desc: 'ЮKassa, CryptoPay' },
]

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({
    companyName: '', currency: 'RUB', timezone: 'Europe/Moscow',
    supportUrl: '', tgChannel: '',
    remnawaveUrl: '', remnawaveToken: '',
    botToken: '', botName: '',
    yukassaShopId: '', yukassaSecretKey: '', cryptopayToken: '',
  })

  useEffect(() => {
    api.me().catch(() => router.push('/login'))
  }, [router])

  const upd = (key: string, val: string) => setForm(p => ({ ...p, [key]: val }))

  const saveStep = async () => {
    setLoading(true)
    try {
      switch (step) {
        case 0:
          await api.setupCompany({
            companyName: form.companyName, currency: form.currency,
            timezone: form.timezone, supportUrl: form.supportUrl, tgChannel: form.tgChannel,
          })
          break
        case 1:
          if (form.remnawaveUrl && form.remnawaveToken) {
            await api.setupRemnawave({ url: form.remnawaveUrl, token: form.remnawaveToken })
          }
          break
        case 2:
          if (form.botToken && form.botName) {
            await api.setupTelegram({ botToken: form.botToken, botName: form.botName })
          }
          break
        case 3:
          await api.setupPayments({
            yukassaShopId: form.yukassaShopId || undefined,
            yukassaSecretKey: form.yukassaSecretKey || undefined,
            cryptopayToken: form.cryptopayToken || undefined,
          })
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
    else {
      api.setupComplete().then(() => router.push('/admin'))
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                  i < step ? 'bg-success-700 text-white' :
                  i === step ? 'bg-primary-600 text-white' :
                  'bg-gray-200 text-gray-400'
                }`}>
                  {i < step ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 ${i < step ? 'bg-success-700' : 'bg-gray-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-1">{STEPS[step].title}</h2>
          <p className="text-sm text-gray-400 mb-6">{STEPS[step].desc}</p>

          {/* Step 0: Company */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Название проекта *</label>
                <input value={form.companyName} onChange={e => upd('companyName', e.target.value)} className="input" placeholder="HIDEYOU VPN" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Валюта</label>
                  <select value={form.currency} onChange={e => upd('currency', e.target.value)} className="input">
                    <option value="RUB">RUB</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="USDT">USDT</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Таймзона</label>
                  <select value={form.timezone} onChange={e => upd('timezone', e.target.value)} className="input">
                    <option value="Europe/Moscow">Москва (UTC+3)</option>
                    <option value="Europe/Kiev">Киев (UTC+2)</option>
                    <option value="Asia/Almaty">Алматы (UTC+6)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Ссылка на поддержку</label>
                <input value={form.supportUrl} onChange={e => upd('supportUrl', e.target.value)} className="input" placeholder="https://t.me/support" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Telegram-канал</label>
                <input value={form.tgChannel} onChange={e => upd('tgChannel', e.target.value)} className="input" placeholder="https://t.me/channel" />
              </div>
            </div>
          )}

          {/* Step 1: REMNAWAVE */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-primary-50 text-primary-600 text-xs">
                Подключите REMNAWAVE-панель для управления VPN-подписками. Можно пропустить и настроить позже.
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">URL панели</label>
                <input value={form.remnawaveUrl} onChange={e => upd('remnawaveUrl', e.target.value)} className="input" placeholder="https://panel.example.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">API токен</label>
                <input type="password" value={form.remnawaveToken} onChange={e => upd('remnawaveToken', e.target.value)} className="input" placeholder="Bearer token" />
              </div>
            </div>
          )}

          {/* Step 2: Telegram */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-primary-50 text-primary-600 text-xs">
                Создайте бота через @BotFather и вставьте токен. Можно пропустить.
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Bot Token</label>
                <input type="password" value={form.botToken} onChange={e => upd('botToken', e.target.value)} className="input" placeholder="123456:ABC-DEF..." />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Bot Username (без @)</label>
                <input value={form.botName} onChange={e => upd('botName', e.target.value)} className="input" placeholder="MyVPNBot" />
              </div>
            </div>
          )}

          {/* Step 3: Payments */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-primary-50 text-primary-600 text-xs">
                Подключите платёжные системы. Все поля необязательны — можно настроить позже.
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">ЮKassa Shop ID</label>
                <input value={form.yukassaShopId} onChange={e => upd('yukassaShopId', e.target.value)} className="input" placeholder="Shop ID" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">ЮKassa Secret Key</label>
                <input type="password" value={form.yukassaSecretKey} onChange={e => upd('yukassaSecretKey', e.target.value)} className="input" placeholder="Secret key" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">CryptoPay API Token</label>
                <input type="password" value={form.cryptopayToken} onChange={e => upd('cryptopayToken', e.target.value)} className="input" placeholder="API token" />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button onClick={saveStep} disabled={loading || (step === 0 && !form.companyName)} className="btn-primary flex-1 py-2.5">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {step < STEPS.length - 1 ? 'Далее' : 'Завершить'}
              {!loading && step < STEPS.length - 1 && <ChevronRight className="w-4 h-4" />}
            </button>
            {step > 0 && step < STEPS.length && (
              <button onClick={skip} className="btn-ghost px-4 py-2.5">
                <SkipForward className="w-4 h-4" /> Пропустить
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
