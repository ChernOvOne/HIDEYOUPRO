'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Users, CreditCard, Package, Newspaper, Wifi, BookOpen,
  Tag, MessageCircle, TrendingUp, Globe, Upload, Settings, LogOut, Menu, X,
  DollarSign, Handshake, Megaphone, Server, FileBarChart, GitCompare, Bot,
  Loader2, Bell, PanelLeft, Ticket, BookMarked, Share2,
} from 'lucide-react'
import { api } from '@/lib/api'

const NAV = [
  { href: '/admin',                icon: LayoutDashboard, label: 'Дашборд',        group: 'main' },
  { href: '/admin/users',          icon: Users,           label: 'Пользователи',  group: 'vpn' },
  { href: '/admin/payments',       icon: CreditCard,      label: 'Платежи',       group: 'vpn' },
  { href: '/admin/tariffs',        icon: Package,         label: 'Тарифы',        group: 'vpn' },
  { href: '/admin/promos',         icon: Ticket,          label: 'Промокоды',     group: 'vpn' },
  { href: '/admin/accounting',     icon: DollarSign,      label: 'Бухгалтерия',   group: 'finance' },
  { href: '/admin/partners',       icon: Handshake,       label: 'Партнёры',      group: 'finance' },
  { href: '/admin/servers',        icon: Server,          label: 'Рег. платежи',  group: 'finance' },
  { href: '/admin/marketing',      icon: Megaphone,       label: 'Маркетинг',     group: 'marketing' },
  { href: '/admin/communications', icon: MessageCircle,   label: 'Коммуникации',  group: 'tools' },
  { href: '/admin/bot/constructor',icon: Bot,             label: 'Конструктор',   group: 'tools' },
  { href: '/admin/bot',            icon: MessageCircle,   label: 'Чат бота',      group: 'tools' },
  { href: '/admin/notifications',  icon: Bell,            label: 'Уведомления',   group: 'tools' },
  { href: '/admin/news',           icon: Newspaper,       label: 'Новости',       group: 'content' },
  { href: '/admin/instructions',   icon: BookMarked,      label: 'Инструкции',    group: 'content' },
  { href: '/admin/proxies',        icon: Share2,          label: 'Прокси',        group: 'content' },
  { href: '/admin/compare',        icon: GitCompare,      label: 'Сравнение',     group: 'analytics' },
  { href: '/admin/import',         icon: Upload,          label: 'Импорт',        group: 'system' },
  { href: '/admin/landing',        icon: PanelLeft,       label: 'Лендинг',       group: 'system' },
  { href: '/admin/settings',       icon: Settings,        label: 'Настройки',     group: 'system' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [sideOpen, setSideOpen] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    api.me()
      .then(u => {
        if (cancelled) return
        if (u.role !== 'ADMIN' && u.role !== 'EDITOR') {
          router.replace('/dashboard')
        } else {
          setUser(u)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) router.replace('/login')
      })
    return () => { cancelled = true }
  }, [])

  const logout = async () => {
    await api.logout()
    router.push('/login')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
    </div>
  )

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <div className="flex h-screen bg-surface" style={{ color: '#111827' }}>
      {/* ═══ Desktop Sidebar (56px) ═══ */}
      <aside className="hidden md:flex flex-col w-14 bg-white border-r border-gray-100 flex-shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center justify-center">
          <div className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center text-sm font-bold">
            H
          </div>
        </div>

        {/* Nav icons */}
        <nav className="flex-1 py-2 flex flex-col items-center gap-0.5 overflow-y-auto">
          {NAV.map(item => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link key={item.href} href={item.href} title={item.label}>
                <div className={`sidebar-icon ${
                  active
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                  <Icon className="w-[18px] h-[18px]" />
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="py-2 flex flex-col items-center gap-1 border-t border-gray-100">
          <button onClick={logout} title="Выйти" className="sidebar-icon text-gray-400 hover:text-danger-600 hover:bg-danger-50">
            <LogOut className="w-[18px] h-[18px]" />
          </button>
          <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-medium" title={user?.email}>
            {(user?.telegramName || user?.email || 'A')[0].toUpperCase()}
          </div>
        </div>
      </aside>

      {/* ═══ Mobile Header ═══ */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 flex items-center px-4 z-40">
        <button onClick={() => setSideOpen(true)} className="p-1.5">
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        <span className="ml-3 text-sm font-medium">HIDEYOU PRO</span>
      </div>

      {/* ═══ Mobile Drawer ═══ */}
      {sideOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSideOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white transform transition-transform duration-300 overflow-y-auto">
            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100">
              <span className="font-semibold text-primary-600">HIDEYOU PRO</span>
              <button onClick={() => setSideOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <nav className="p-3 space-y-0.5">
              {NAV.map(item => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link key={item.href} href={item.href} onClick={() => setSideOpen(false)}>
                    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      active
                        ? 'bg-primary-50 text-primary-600 font-medium'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }`}>
                      <Icon className="w-[18px] h-[18px]" />
                      {item.label}
                    </div>
                  </Link>
                )
              })}
            </nav>
            <div className="p-3 border-t border-gray-100">
              <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-danger-600 w-full">
                <LogOut className="w-[18px] h-[18px]" /> Выйти
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Main content ═══ */}
      <main className="flex-1 overflow-y-auto md:pt-0 pt-14">
        {children}
      </main>
    </div>
  )
}
