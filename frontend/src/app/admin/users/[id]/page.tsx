'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Shield, Plus, CreditCard, Users, Mail, MessageCircle,
  Copy, CheckCircle2, Clock, Trash2, Bell, RefreshCw, Ban,
  Calendar, Globe, FileText, DollarSign, ChevronDown, Wallet,
  Tag, Star, Loader2, KeyRound, Smartphone, Wifi, Filter,
  ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { adminApi } from '@/lib/api'

function fmtBytes(b: number) {
  if (!b) return '0 Б'
  const k = 1024, s = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return `${(b / Math.pow(k, i)).toFixed(1)} ${s[i]}`
}

function formatTraffic(used: number, limit: number): string {
  const usedGb = (used / (1024 * 1024 * 1024)).toFixed(1)
  if (!limit || limit === 0) return `${usedGb} ГБ / Безлимит`
  const limitGb = (limit / (1024 * 1024 * 1024)).toFixed(0)
  return `${usedGb} / ${limitGb} ГБ`
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Modals
  const [showExtend, setShowExtend] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [showBalance, setShowBalance] = useState(false)
  const [showGrantDays, setShowGrantDays] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showResetPw, setShowResetPw] = useState(false)
  const [showEditRole, setShowEditRole] = useState(false)
  const [showNotify, setShowNotify] = useState(false)

  // Collapsible sections
  const [devicesOpen, setDevicesOpen] = useState(false)
  const [referralsOpen, setReferralsOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(true)
  const [variablesOpen, setVariablesOpen] = useState(false)

  // Activity
  const [activityFilter, setActivityFilter] = useState<string>('all')
  const [activities, setActivities] = useState<any[]>([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)

  // Form state
  const [extendDays, setExtendDays] = useState(30)
  const [noteText, setNoteText] = useState('')
  const [balanceAmount, setBalanceAmount] = useState(0)
  const [balanceDesc, setBalanceDesc] = useState('')
  const [grantDaysCount, setGrantDaysCount] = useState(30)
  const [grantDaysDesc, setGrantDaysDesc] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('')
  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyMsg, setNotifyMsg] = useState('')

  const loadActivities = async () => {
    setActivitiesLoading(true)
    try {
      const data = await adminApi.get(`/users/${id}/activity?limit=50`)
      setActivities(data.items || data.activities || [])
    } catch {
      // Activity endpoint may not exist yet
    } finally {
      setActivitiesLoading(false)
    }
  }

  const load = async () => {
    try {
      const u = await adminApi.get(`/users/${id}`)
      setUser(u)
      loadActivities()
    } catch {
      toast.error('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
    toast.success('Скопировано')
  }

  const action = async (fn: () => Promise<any>, successMsg: string) => {
    setActing(true)
    try {
      await fn()
      toast.success(successMsg)
      await load()
    } catch (err: any) {
      toast.error(err.message || 'Ошибка')
    } finally {
      setActing(false)
    }
  }

  if (loading) return (
    <div className="page-content">
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    </div>
  )

  if (!user) return (
    <div className="page-content">
      <p className="text-gray-400 text-center py-12">Пользователь не найден</p>
    </div>
  )

  const daysLeft = user.subExpireAt
    ? Math.max(0, Math.ceil((new Date(user.subExpireAt).getTime() - Date.now()) / 86400_000))
    : null

  const rmData = user.rmData || null
  const devices = rmData?.devices || user.devices || []
  const geoInfo = user.geoInfo || null

  const statusColor: Record<string, string> = {
    ACTIVE: 'text-emerald-600 bg-emerald-50',
    INACTIVE: 'text-gray-500 bg-gray-100',
    EXPIRED: 'text-red-500 bg-red-50',
    TRIAL: 'text-cyan-600 bg-cyan-50',
  }

  const CopyField = ({ label, value }: { label: string; value: string }) => (
    <div
      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
      onClick={() => copyText(value, label)}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-gray-400">{label}</p>
        <p className="text-sm font-mono text-gray-900 truncate">{value}</p>
      </div>
      {copied === label
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        : <Copy className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />}
    </div>
  )

  const SectionHeader = ({ icon, title, count, open, toggle }: {
    icon: React.ReactNode; title: string; count?: number; open: boolean; toggle: () => void
  }) => (
    <button onClick={toggle} className="w-full flex items-center justify-between py-1">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        {icon} {title}
        {count !== undefined && <span className="text-xs font-normal text-gray-400">({count})</span>}
      </h3>
      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
    </button>
  )

  // ── Build unified activity list ──
  const buildActivityItems = () => {
    const allItems: any[] = []

    // Parse payments into activity items
    if (user.payments?.length) {
      for (const p of user.payments) {
        let meta: any = null
        try { meta = JSON.parse(p.yukassaStatus || p.metadata || '{}') } catch {}

        if (meta?._type === 'referral_redeem') {
          allItems.push({
            id: p.id, type: 'referral_redeem',
            description: 'Активация реферальных дней',
            value: `+${meta.days} дней`,
            date: p.createdAt, status: p.status, meta,
          })
        } else if (meta?._type === 'bonus_redeem') {
          allItems.push({
            id: p.id, type: 'bonus_redeem',
            description: 'Активация бонусных дней',
            value: `+${meta.days} дней`,
            date: p.createdAt, status: p.status, meta,
          })
        } else {
          const modeLabel = meta?._mode === 'variant' ? meta.variantName || meta.tariffName || ''
            : meta?._mode === 'configurator' ? `${meta.days || ''}д / ${meta.devices || ''}устр`
            : ''
          const promoLabel = meta?.promoCode ? ` (промо: ${meta.promoCode}${meta.discountPct ? ` -${meta.discountPct}%` : ''})` : ''

          allItems.push({
            id: p.id, type: 'payment',
            description: [p.provider, modeLabel, p.purpose === 'GIFT' ? 'Подарок' : '', promoLabel].filter(Boolean).join(' · '),
            value: (() => {
              if (p.purpose === 'GIFT' && p.amount === 0) return 'Подарок'
              if (p.amount === 0 && p.provider === 'MANUAL') return 'Бонус'
              const amt = p.currency === 'RUB' ? `${Number(p.amount).toLocaleString('ru')} \u20BD` : `${p.amount} ${p.currency}`
              return amt
            })(),
            originalAmount: meta?.originalAmount ?? null,
            amount: p.amount, currency: p.currency,
            date: p.createdAt, status: p.status, meta,
          })
        }
      }
    }

    // Balance transactions
    if (user.balanceTransactions?.length) {
      for (const tx of user.balanceTransactions) {
        allItems.push({
          id: tx.id, type: 'balance',
          description: tx.description || tx.type || 'Транзакция',
          value: `${Number(tx.amount) >= 0 ? '+' : ''}${Number(tx.amount)} \u20BD`,
          amount: Number(tx.amount),
          date: tx.createdAt, status: 'completed', meta: null,
        })
      }
    }

    // Bonus history
    if (user.bonusHistory?.length) {
      for (const b of user.bonusHistory) {
        allItems.push({
          id: b.id, type: 'bonus_redeem',
          description: b.reason || 'Бонусные дни',
          value: `+${b.days} дн.`,
          date: b.appliedAt || b.createdAt, status: 'completed', meta: null,
        })
      }
    }

    // Merge in activities from API
    for (const a of activities) {
      if (a.type === 'payment' && allItems.some(i => i.id === a.id)) continue
      allItems.push({
        id: a.id, type: a.type,
        description: a.description,
        value: a.amount != null
          ? (a.currency === 'RUB' ? `${a.amount > 0 ? '+' : ''}${a.amount} \u20BD` : `${a.amount} ${a.currency || ''}`)
          : '',
        amount: a.amount,
        date: a.date, status: a.status, meta: a.metadata,
      })
    }

    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return allItems
  }

  const allActivityItems = buildActivityItems()
  const filteredActivity = activityFilter === 'all'
    ? allActivityItems
    : allActivityItems.filter(i => i.type === activityFilter)

  const typeConfig: Record<string, { icon: React.ReactNode; dotBg: string; dotText: string; badgeBg: string; badgeText: string; badgeLabel: string; valueColor: string }> = {
    payment: {
      icon: <CreditCard className="w-4 h-4" />,
      dotBg: 'bg-emerald-100', dotText: 'text-emerald-600',
      badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-600', badgeLabel: 'Платёж',
      valueColor: 'text-emerald-600',
    },
    bonus_redeem: {
      icon: <Star className="w-4 h-4" />,
      dotBg: 'bg-violet-100', dotText: 'text-violet-600',
      badgeBg: 'bg-violet-50', badgeText: 'text-violet-600', badgeLabel: 'Бонус',
      valueColor: 'text-violet-600',
    },
    referral_redeem: {
      icon: <Users className="w-4 h-4" />,
      dotBg: 'bg-cyan-100', dotText: 'text-cyan-600',
      badgeBg: 'bg-cyan-50', badgeText: 'text-cyan-600', badgeLabel: 'Реферал',
      valueColor: 'text-cyan-600',
    },
    promo: {
      icon: <Tag className="w-4 h-4" />,
      dotBg: 'bg-amber-100', dotText: 'text-amber-600',
      badgeBg: 'bg-amber-50', badgeText: 'text-amber-600', badgeLabel: 'Промокод',
      valueColor: 'text-amber-600',
    },
    balance: {
      icon: <Wallet className="w-4 h-4" />,
      dotBg: 'bg-blue-100', dotText: 'text-blue-600',
      badgeBg: 'bg-blue-50', badgeText: 'text-blue-600', badgeLabel: 'Баланс',
      valueColor: 'text-blue-600',
    },
  }

  return (
    <>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/users')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="page-title">
              {user.telegramName || user.email?.split('@')[0] || 'Пользователь'}
            </h1>
            <p className="page-subtitle font-mono">{user.id}</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button onClick={() => setShowExtend(true)} className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Добавить дни
          </button>
          <button onClick={() => action(() => adminApi.post(`/users/${id}/revoke`), 'Ссылка подписки обновлена')}
            className="btn-default text-xs py-2 px-3 flex items-center gap-1.5" disabled={acting}>
            <RefreshCw className="w-3.5 h-3.5" /> Обновить ссылку
          </button>
          <button onClick={() => action(() => adminApi.post(`/users/${id}/reset-traffic`), 'Трафик сброшен')}
            className="btn-default text-xs py-2 px-3 flex items-center gap-1.5" disabled={acting}>
            <RefreshCw className="w-3.5 h-3.5" /> Сброс трафика
          </button>
          <button onClick={() => setShowNotify(true)} className="btn-default text-xs py-2 px-3 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" /> Уведомление
          </button>
          <button onClick={() => setShowNote(true)} className="btn-default text-xs py-2 px-3 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Заметка
          </button>
          <button onClick={() => setShowBalance(true)} className="btn-default text-xs py-2 px-3 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Баланс
          </button>
          <button onClick={() => setShowGrantDays(true)} className="btn-default text-xs py-2 px-3 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Бонусные дни
          </button>
          <button onClick={() => { setNewRole(user.role); setShowEditRole(true) }} className="btn-default text-xs py-2 px-3 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Роль
          </button>
          <button onClick={() => setShowResetPw(true)} className="btn-default text-xs py-2 px-3 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" /> Пароль
          </button>
          <button
            onClick={() => action(
              () => adminApi.post(`/users/${id}/toggle`),
              user.isActive ? 'Пользователь заблокирован' : 'Пользователь разблокирован'
            )}
            className="text-xs py-2 px-3 flex items-center gap-1.5 rounded-lg border transition-colors bg-white border-red-200 text-red-500 hover:bg-red-50"
            disabled={acting}
          >
            <Ban className="w-3.5 h-3.5" />
            {user.isActive ? 'Заблокировать' : 'Разблокировать'}
          </button>
          <button onClick={() => setShowDelete(true)}
            className="text-xs py-2 px-3 flex items-center gap-1.5 rounded-lg border transition-colors bg-white border-red-200 text-red-500 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" /> Удалить
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* ---- Left column: profile ---- */}
          <div className="space-y-5">
            {/* Profile card */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex flex-col items-center text-center mb-4">
                <div className="w-14 h-14 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center text-xl font-bold mb-3">
                  {(user.telegramName || user.email || 'П')[0].toUpperCase()}
                </div>
                <p className="font-semibold text-gray-900">
                  {user.telegramName || user.email?.split('@')[0] || 'Без имени'}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap justify-center">
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColor[user.subStatus] || statusColor.INACTIVE}`}>
                    {user.subStatus}
                  </span>
                  {!user.isActive && (
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full text-red-600 bg-red-50">BLOCKED</span>
                  )}
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full text-primary-600 bg-primary-50">{user.role}</span>
                </div>
              </div>

              <div className="space-y-0.5 border-t border-gray-100 pt-3">
                {rmData?.username && <CopyField label="RW Username" value={rmData.username} />}
                {user.email && <CopyField label="Email" value={user.email} />}
                {user.telegramId && <CopyField label="Telegram ID" value={user.telegramId} />}
                {user.telegramName && <CopyField label="TG имя" value={`@${user.telegramName}`} />}
                {user.referralCode && <CopyField label="Реф. код" value={user.referralCode} />}
                {user.remnawaveUuid && <CopyField label="RW UUID" value={user.remnawaveUuid} />}
                <CopyField label="ID" value={user.id} />
                {rmData?.subscriptionUrl && <CopyField label="Ссылка подписки" value={rmData.subscriptionUrl} />}
              </div>

              <div className="space-y-1.5 border-t border-gray-100 pt-3 mt-3 text-xs text-gray-400">
                <p>Регистрация: {new Date(user.createdAt).toLocaleString('ru')}</p>
                {user.lastLoginAt && <p>Последний вход: {new Date(user.lastLoginAt).toLocaleString('ru')}</p>}
                {rmData?.firstConnectedAt && <p>Первое подключение: {new Date(rmData.firstConnectedAt).toLocaleString('ru')}</p>}
                {rmData?.onlineAt && <p>Онлайн: {new Date(rmData.onlineAt).toLocaleString('ru')}</p>}
                {rmData?.subLastOpenedAt && <p>Последнее открытие подписки: {new Date(rmData.subLastOpenedAt).toLocaleString('ru')}</p>}
                {rmData?.subLastUserAgent && <p>Приложение: {rmData.subLastUserAgent}</p>}
                {user.utmCode && <p>UTM: {user.utmCode}</p>}
              </div>

              {/* IP & Geo info */}
              {(user.lastIp || geoInfo) && (
                <div className="space-y-2 border-t border-gray-100 pt-3 mt-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Последний IP</p>
                  {user.lastIp && <CopyField label="IP адрес" value={user.lastIp} />}
                  {geoInfo && (
                    <div className="space-y-1.5 text-xs text-gray-400">
                      {geoInfo.country && (
                        <div className="flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{geoInfo.country}{geoInfo.city ? `, ${geoInfo.city}` : ''}</span>
                        </div>
                      )}
                      {geoInfo.region && geoInfo.region !== geoInfo.city && (
                        <div className="flex items-center gap-2">
                          <span className="w-3.5" />
                          <span>{geoInfo.region}</span>
                        </div>
                      )}
                      {geoInfo.isp && (
                        <div className="flex items-center gap-2">
                          <Wifi className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{geoInfo.isp}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* KPI stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">LTV</p>
                <p className="text-lg font-semibold text-gray-900">{Number(user.totalPaid || 0).toLocaleString('ru')} &#8381;</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Баланс</p>
                <p className="text-lg font-semibold text-gray-900">{Number(user.balance || 0)} &#8381;</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Бонусные дни</p>
                <p className="text-lg font-semibold text-gray-900">{user.bonusDays || 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Рефералы</p>
                <p className="text-lg font-semibold text-gray-900">{user._count?.referrals || 0}</p>
              </div>
            </div>

            {/* REMNAWAVE Subscription card */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary-600" /> Подписка REMNAWAVE
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Статус</span>
                  <span className={`font-medium ${
                    (rmData?.status || user.subStatus) === 'ACTIVE' ? 'text-emerald-600'
                    : (rmData?.status || user.subStatus) === 'EXPIRED' ? 'text-red-500'
                    : 'text-gray-500'
                  }`}>
                    {rmData?.status || user.subStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Истекает</span>
                  <span className="text-gray-900 font-medium">
                    {user.subExpireAt ? new Date(user.subExpireAt).toLocaleDateString('ru') : '--'}
                  </span>
                </div>
                {daysLeft !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Дней осталось</span>
                    <span className={`font-medium ${daysLeft <= 3 ? 'text-red-500' : daysLeft <= 7 ? 'text-amber-500' : 'text-emerald-600'}`}>
                      {daysLeft}
                    </span>
                  </div>
                )}
                {rmData && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Трафик</span>
                      <span className="text-gray-900 font-medium">
                        {formatTraffic(rmData.usedTrafficBytes, rmData.trafficLimitBytes)}
                      </span>
                    </div>
                    {/* Traffic progress bar */}
                    {rmData.trafficLimitBytes > 0 && (
                      <div className="w-full h-2 rounded-full overflow-hidden bg-gray-100">
                        <div className="h-full rounded-full bg-primary-600 transition-all"
                          style={{ width: `${Math.min(100, Math.round(rmData.usedTrafficBytes / rmData.trafficLimitBytes * 100))}%` }} />
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Лимит устройств</span>
                      <span className="text-gray-900 font-medium">
                        {rmData.hwidDeviceLimit === 0 ? 'Безлимит' : String(rmData.hwidDeviceLimit ?? '--')}
                      </span>
                    </div>
                    {rmData.tag && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Тег</span>
                        <span className="text-gray-900 font-medium">{rmData.tag}</span>
                      </div>
                    )}
                    {rmData.onlineAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Онлайн</span>
                        <span className="text-gray-900 text-xs">{new Date(rmData.onlineAt).toLocaleString('ru')}</span>
                      </div>
                    )}
                    {rmData.firstConnectedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Первое подключение</span>
                        <span className="text-gray-900 text-xs">{new Date(rmData.firstConnectedAt).toLocaleString('ru')}</span>
                      </div>
                    )}
                    {rmData.subLastOpenedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Последнее открытие</span>
                        <span className="text-gray-900 text-xs">{new Date(rmData.subLastOpenedAt).toLocaleString('ru')}</span>
                      </div>
                    )}
                    {rmData.subLastUserAgent && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">User Agent</span>
                        <span className="text-gray-900 text-xs truncate max-w-[180px]">{rmData.subLastUserAgent}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Платежи</span>
                  <span className="text-gray-900">{user._count?.payments || 0}</span>
                </div>
              </div>
            </div>

            {/* Referrals */}
            {user.referrals?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <SectionHeader
                  icon={<Users className="w-4 h-4 text-primary-600" />}
                  title="Рефералы"
                  count={user.referrals.length}
                  open={referralsOpen}
                  toggle={() => setReferralsOpen(!referralsOpen)}
                />
                {referralsOpen && (
                  <div className="mt-3 space-y-1">
                    {user.referrals.map((ref: any) => (
                      <button
                        key={ref.id}
                        onClick={() => router.push(`/admin/users/${ref.id}`)}
                        className="w-full flex items-center justify-between p-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-gray-900">
                          {ref.telegramName || ref.email?.split('@')[0] || ref.id.slice(0, 8)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{Number(ref.totalPaid || 0).toLocaleString('ru')} &#8381;</span>
                          <ArrowLeft className="w-3 h-3 text-gray-300 rotate-180" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ---- Right column: details ---- */}
          <div className="lg:col-span-2 space-y-5">

            {/* Devices (collapsible) */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionHeader
                icon={<Smartphone className="w-4 h-4 text-primary-600" />}
                title="Устройства"
                count={devices.length}
                open={devicesOpen}
                toggle={() => setDevicesOpen(!devicesOpen)}
              />
              {devicesOpen && (
                <div className="mt-3 space-y-2">
                  {devices.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4 text-center">Нет подключённых устройств</p>
                  ) : (
                    devices.map((d: any) => (
                      <div key={d.hwid || d.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                        {/* Platform icon */}
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-50">
                          {d.platform === 'iOS' ? <Smartphone className="w-5 h-5 text-primary-600" /> :
                           d.platform === 'Android' ? <Smartphone className="w-5 h-5 text-emerald-600" /> :
                           <Globe className="w-5 h-5 text-primary-600" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">
                            {d.deviceModel || d.platform || 'Неизвестное устройство'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {[d.platform, d.osVersion ? `v${d.osVersion}` : null].filter(Boolean).join(' ')}
                            {d.userAgent && (() => {
                              const parts = d.userAgent.split('/')
                              const appName = parts[0] || ''
                              const appVersion = parts[1] || ''
                              return <span className="text-gray-400"> · {appName} {appVersion}</span>
                            })()}
                          </p>
                          <p className="text-[10px] font-mono text-gray-400 mt-0.5 truncate">
                            HWID: {d.hwid}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                          <span className="text-[10px] text-gray-400">
                            {d.createdAt ? new Date(d.createdAt).toLocaleDateString('ru') : ''}
                          </span>
                          <button
                            onClick={() => action(
                              () => adminApi.delete(`/users/${id}/devices/${d.hwid}`),
                              'Устройство удалено'
                            )}
                            className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                            title="Удалить устройство">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Unified Activity Timeline */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary-600" /> История активности
              </h3>

              {/* Filter tabs */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {([
                  { key: 'all', label: 'Все' },
                  { key: 'payment', label: 'Платежи' },
                  { key: 'bonus_redeem', label: 'Бонусные дни' },
                  { key: 'referral_redeem', label: 'Реферальные дни' },
                  { key: 'promo', label: 'Промокоды' },
                  { key: 'balance', label: 'Баланс' },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActivityFilter(tab.key)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                      activityFilter === tab.key
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Timeline */}
              {filteredActivity.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">
                  {activitiesLoading ? 'Загрузка...' : 'Нет записей'}
                </p>
              ) : (
                <div className="space-y-0">
                  {filteredActivity.map((item, idx) => {
                    const cfg = typeConfig[item.type] || typeConfig.payment
                    const isLast = idx === filteredActivity.length - 1

                    return (
                      <div key={item.id + '-' + idx} className="flex gap-3 relative">
                        {/* Timeline line + dot */}
                        <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.dotBg} ${cfg.dotText}`}>
                            {cfg.icon}
                          </div>
                          {!isLast && (
                            <div className="flex-1 w-px my-1 bg-gray-200" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-4">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-gray-900">
                                  {item.description}
                                </p>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.badgeBg} ${cfg.badgeText}`}>
                                  {cfg.badgeLabel}
                                </span>
                                {item.status && item.status !== 'PAID' && item.status !== 'completed' && (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                    item.status === 'PENDING' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500'
                                  }`}>
                                    {item.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {new Date(item.date).toLocaleString('ru')}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className={`text-sm font-semibold ${cfg.valueColor}`}>
                                {item.value}
                              </p>
                              {item.originalAmount != null && item.originalAmount !== item.amount && (
                                <p className="text-[10px] line-through text-gray-400">
                                  {item.currency === 'RUB' ? `${Number(item.originalAmount).toLocaleString('ru')} \u20BD` : `${item.originalAmount}`}
                                </p>
                              )}
                              {item.meta?.promoCode && (
                                <p className="text-[10px] mt-0.5 text-violet-600">
                                  {item.meta.promoCode}{item.meta.discountPct ? ` -${item.meta.discountPct}%` : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Admin Notes */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionHeader
                icon={<FileText className="w-4 h-4 text-primary-600" />}
                title="Заметки"
                count={user.adminNotesOnUser?.length}
                open={notesOpen}
                toggle={() => setNotesOpen(!notesOpen)}
              />
              {notesOpen && (
                <div className="mt-3">
                  {!user.adminNotesOnUser?.length ? (
                    <p className="text-sm text-gray-400 py-4 text-center">Нет заметок</p>
                  ) : (
                    <div className="space-y-2">
                      {user.adminNotesOnUser.map((note: any) => (
                        <div key={note.id} className="flex items-start justify-between p-3 rounded-lg bg-gray-50">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-900">{note.note || note.text}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {note.author?.telegramName || note.admin?.telegramName || 'Админ'} &middot; {new Date(note.createdAt).toLocaleString('ru')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tags */}
            {user.userTags?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-primary-600" /> Теги
                </h3>
                <div className="flex flex-wrap gap-2">
                  {user.userTags.map((t: any) => (
                    <span key={t.id} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-600 flex items-center gap-1">
                      <Tag className="w-3 h-3" />{t.tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* User Variables */}
            {user.userVariables?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <SectionHeader
                  icon={<Globe className="w-4 h-4 text-primary-600" />}
                  title="Переменные"
                  count={user.userVariables.length}
                  open={variablesOpen}
                  toggle={() => setVariablesOpen(!variablesOpen)}
                />
                {variablesOpen && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-[10px] uppercase tracking-wider text-gray-400 font-medium pb-2 pr-4">Ключ</th>
                          <th className="text-left text-[10px] uppercase tracking-wider text-gray-400 font-medium pb-2">Значение</th>
                        </tr>
                      </thead>
                      <tbody>
                        {user.userVariables.map((v: any) => (
                          <tr key={v.id} className="border-b border-gray-50 last:border-0">
                            <td className="py-2 pr-4 font-mono text-xs text-primary-600">{v.key}</td>
                            <td className="py-2 text-gray-900">{v.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Modals ===== */}

      {/* Extend subscription */}
      {showExtend && (
        <ModalOverlay onClose={() => setShowExtend(false)} title="Добавить дни подписки">
          <input type="number" className="input w-full" placeholder="Количество дней"
            value={extendDays} onChange={e => setExtendDays(+e.target.value)} min={1} />
          <button onClick={() => {
            action(() => adminApi.post(`/users/${id}/add-days`, { days: extendDays }), `+${extendDays} дн.`)
            setShowExtend(false)
          }} className="btn-primary w-full justify-center" disabled={acting}>
            +{extendDays} дн.
          </button>
        </ModalOverlay>
      )}

      {/* Notify */}
      {showNotify && (
        <ModalOverlay onClose={() => setShowNotify(false)} title="Отправить уведомление">
          <input className="input w-full" placeholder="Заголовок"
            value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} />
          <textarea className="input w-full min-h-[80px] resize-y" placeholder="Сообщение"
            value={notifyMsg} onChange={e => setNotifyMsg(e.target.value)} />
          <button onClick={() => {
            action(() => adminApi.post(`/users/${id}/notify`, { title: notifyTitle, message: notifyMsg }), 'Уведомление отправлено')
            setShowNotify(false); setNotifyTitle(''); setNotifyMsg('')
          }} className="btn-primary w-full justify-center" disabled={acting || !notifyTitle || !notifyMsg}>
            Отправить
          </button>
        </ModalOverlay>
      )}

      {/* Add note */}
      {showNote && (
        <ModalOverlay onClose={() => setShowNote(false)} title="Добавить заметку">
          <textarea className="input w-full min-h-[80px] resize-y" placeholder="Текст заметки..."
            value={noteText} onChange={e => setNoteText(e.target.value)} />
          <button onClick={() => {
            action(() => adminApi.post(`/users/${id}/note`, { note: noteText }), 'Заметка добавлена')
            setShowNote(false); setNoteText('')
          }} className="btn-primary w-full justify-center" disabled={acting || !noteText}>
            Сохранить
          </button>
        </ModalOverlay>
      )}

      {/* Adjust balance */}
      {showBalance && (
        <ModalOverlay onClose={() => setShowBalance(false)} title="Изменить баланс">
          <p className="text-sm text-gray-500">
            Текущий баланс: <strong className="text-gray-900">{Number(user.balance || 0).toFixed(2)} &#8381;</strong>
          </p>
          <input type="number" className="input w-full" placeholder="Сумма (+ пополнение, - списание)"
            value={balanceAmount} onChange={e => setBalanceAmount(+e.target.value)} />
          <input className="input w-full" placeholder="Описание"
            value={balanceDesc} onChange={e => setBalanceDesc(e.target.value)} />
          <button onClick={() => {
            action(
              () => adminApi.put(`/users/${id}`, { balance: Number(user.balance || 0) + balanceAmount }),
              'Баланс обновлён'
            )
            setShowBalance(false); setBalanceAmount(0); setBalanceDesc('')
          }} className="btn-primary w-full justify-center" disabled={acting || balanceAmount === 0}>
            {balanceAmount >= 0 ? `+${balanceAmount}` : `${balanceAmount}`} &#8381;
          </button>
        </ModalOverlay>
      )}

      {/* Grant bonus days */}
      {showGrantDays && (
        <ModalOverlay onClose={() => setShowGrantDays(false)} title="Начислить бонусные дни">
          <p className="text-sm text-gray-500">
            Текущие бонусные дни: <strong className="text-gray-900">{user.bonusDays ?? 0}</strong>
          </p>
          <input type="number" className="input w-full" placeholder="Количество дней"
            value={grantDaysCount} onChange={e => setGrantDaysCount(+e.target.value)} min={1} />
          <input className="input w-full" placeholder="Описание (необязательно)"
            value={grantDaysDesc} onChange={e => setGrantDaysDesc(e.target.value)} />
          <button onClick={() => {
            action(
              () => adminApi.put(`/users/${id}`, { bonusDays: (user.bonusDays || 0) + grantDaysCount }),
              `+${grantDaysCount} бонусных дн.`
            )
            setShowGrantDays(false); setGrantDaysCount(30); setGrantDaysDesc('')
          }} className="btn-primary w-full justify-center" disabled={acting || grantDaysCount < 1}>
            +{grantDaysCount} бонусных дн.
          </button>
        </ModalOverlay>
      )}

      {/* Reset password */}
      {showResetPw && (
        <ModalOverlay onClose={() => setShowResetPw(false)} title="Сбросить пароль">
          <input type="password" className="input w-full" placeholder="Новый пароль (мин. 6 символов)"
            value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <button onClick={() => {
            action(
              () => adminApi.post(`/users/${id}/reset-password`, { password: newPassword }),
              'Пароль сброшен'
            )
            setShowResetPw(false); setNewPassword('')
          }} className="btn-primary w-full justify-center" disabled={acting || newPassword.length < 6}>
            Сбросить пароль
          </button>
        </ModalOverlay>
      )}

      {/* Edit role */}
      {showEditRole && (
        <ModalOverlay onClose={() => setShowEditRole(false)} title="Изменить роль">
          <select className="input w-full" value={newRole} onChange={e => setNewRole(e.target.value)}>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="EDITOR">EDITOR</option>
            <option value="INVESTOR">INVESTOR</option>
          </select>
          <button onClick={() => {
            action(
              () => adminApi.put(`/users/${id}`, { role: newRole }),
              `Роль изменена на ${newRole}`
            )
            setShowEditRole(false)
          }} className="btn-primary w-full justify-center" disabled={acting}>
            Сохранить
          </button>
        </ModalOverlay>
      )}

      {/* Delete confirmation */}
      {showDelete && (
        <ModalOverlay onClose={() => setShowDelete(false)} title="Удалить пользователя">
          <p className="text-sm text-gray-500">
            Вы уверены, что хотите удалить <strong className="text-gray-900">{user.telegramName || user.email || user.id}</strong>?
            Это действие необратимо.
          </p>
          <div className="space-y-2">
            {/* Full delete */}
            <button onClick={() => {
              action(() => adminApi.delete(`/users/${id}`), 'Пользователь полностью удалён').then(() => router.push('/admin/users'))
              setShowDelete(false)
            }} className="w-full text-left p-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
              disabled={acting}>
              <p className="text-sm font-medium text-red-600">Удалить полностью</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Из БД + REMNAWAVE + бот. Необратимо.</p>
            </button>

            {/* REMNAWAVE only */}
            {user.remnawaveUuid && (
              <button onClick={() => {
                action(
                  () => adminApi.post(`/users/${id}/delete-remnawave`),
                  'Подписка REMNAWAVE удалена'
                )
                setShowDelete(false)
              }} className="w-full text-left p-3 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors"
                disabled={acting}>
                <p className="text-sm font-medium text-amber-600">Только подписку REMNAWAVE</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Удалит из VPN-панели, аккаунт в системе останется.</p>
              </button>
            )}

            {/* Web account only */}
            <button onClick={() => {
              action(
                () => adminApi.post(`/users/${id}/delete-web`),
                'Веб-аккаунт удалён'
              ).then(() => router.push('/admin/users'))
              setShowDelete(false)
            }} className="w-full text-left p-3 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 transition-colors"
              disabled={acting}>
              <p className="text-sm font-medium text-violet-600">Только из веб-системы</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Удалит из БД, REMNAWAVE не затронет.</p>
            </button>

            {/* Remove from bot */}
            {user.telegramId && (
              <button onClick={() => {
                action(
                  () => adminApi.post(`/users/${id}/delete-bot`),
                  'Пользователь удалён из бота'
                )
                setShowDelete(false)
              }} className="w-full text-left p-3 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                disabled={acting}>
                <p className="text-sm font-medium text-gray-700">Только из бота</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Удалит историю чата и отвяжет Telegram. Веб-аккаунт и подписка останутся.</p>
              </button>
            )}

            <button onClick={() => setShowDelete(false)} className="btn-default w-full justify-center mt-1">
              Отмена
            </button>
          </div>
        </ModalOverlay>
      )}
    </>
  )
}

function ModalOverlay({ children, onClose, title }: {
  children: React.ReactNode; onClose: () => void; title: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl border border-gray-100 p-5 w-full max-w-md space-y-4 shadow-lg">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {children}
      </div>
    </div>
  )
}
