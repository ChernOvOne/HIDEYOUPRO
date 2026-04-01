'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Search, Send, ArrowLeft, User, MessageCircle,
  ExternalLink, X, Calendar, Wallet, Gift, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ---------- types ---------- */

interface ChatUser {
  id: string
  telegramId?: string
  telegramName?: string
  email?: string
  subStatus: string
  balance?: number
  bonusDays?: number
  createdAt: string
  role?: string
}

interface ChatListItem {
  user: ChatUser
  lastMessage: string
  lastDate: string
  messageCount: number
}

interface Message {
  id: string
  direction: 'IN' | 'OUT'
  text: string
  buttonsJson?: string | null
  createdAt: string
}

/* ---------- helpers ---------- */

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 86400000 && d.getDate() === now.getDate())
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  if (diff < 604800000)
    return d.toLocaleDateString('ru', { weekday: 'short' })
  return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const fmtFull = (iso: string) =>
  new Date(iso).toLocaleString('ru', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

const initial = (u: ChatUser) =>
  (u.telegramName || u.email || 'U')[0].toUpperCase()

const displayName = (u: ChatUser) =>
  u.telegramName || u.email?.split('@')[0] || `ID:${u.id.slice(0, 8)}`

/* ---------- component ---------- */

export default function AdminBotChats() {
  const [chats, setChats]           = useState<ChatListItem[]>([])
  const [chatsTotal, setChatsTotal] = useState(0)
  const [chatsPage, setChatsPage]   = useState(1)
  const [search, setSearch]         = useState('')
  const [chatsLoading, setChatsLoading] = useState(true)

  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  const [activeUser, setActiveUser]     = useState<ChatUser | null>(null)
  const [messages, setMessages]         = useState<Message[]>([])
  const [msgsTotal, setMsgsTotal]       = useState(0)
  const [msgsPage, setMsgsPage]         = useState(1)
  const [msgsLoading, setMsgsLoading]   = useState(false)

  const [draft, setDraft]     = useState('')
  const [sending, setSending] = useState(false)

  const [mobileListOpen, setMobileListOpen]       = useState(true)
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const searchTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ---------- load chats ---------- */

  const loadChats = useCallback(async (pg = chatsPage, q = search) => {
    setChatsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg), limit: '30', search: q })
      const res = await fetch(`/api/admin/bot-blocks/chats?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setChats(data.chats)
      setChatsTotal(data.total)
    } catch {
      toast.error('Ошибка загрузки чатов')
    } finally {
      setChatsLoading(false)
    }
  }, [chatsPage, search])

  useEffect(() => { loadChats() }, [loadChats])

  const onSearchChange = (v: string) => {
    setSearch(v)
    setChatsPage(1)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => loadChats(1, v), 300)
  }

  /* ---------- load messages ---------- */

  const loadMessages = useCallback(async (userId: string, pg = 1, append = false) => {
    setMsgsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pg), limit: '100' })
      const res = await fetch(`/api/admin/bot-blocks/chats/${userId}?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMessages(prev => append ? [...data.messages.reverse(), ...prev] : data.messages)
      setMsgsTotal(data.total)
      setMsgsPage(pg)
    } catch {
      toast.error('Ошибка загрузки сообщений')
    } finally {
      setMsgsLoading(false)
    }
  }, [])

  const selectChat = (item: ChatListItem) => {
    setActiveUserId(item.user.id)
    setActiveUser(item.user)
    setMessages([])
    setMsgsPage(1)
    loadMessages(item.user.id, 1)
    setMobileListOpen(false)
    setMobileProfileOpen(false)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* ---------- send message ---------- */

  const sendMessage = async () => {
    if (!draft.trim() || !activeUserId) return
    setSending(true)
    try {
      const res = await fetch(`/api/admin/bot-blocks/chats/${activeUserId}/send`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: draft.trim() }),
      })
      if (!res.ok) throw new Error()
      setDraft('')
      await loadMessages(activeUserId, 1)
      loadChats()
    } catch {
      toast.error('Ошибка отправки сообщения')
    } finally {
      setSending(false)
    }
  }

  /* ---------- render buttons ---------- */

  const renderButtons = (json: string | null | undefined) => {
    if (!json) return null
    try {
      const rows: { text: string; url?: string }[][] = JSON.parse(json)
      return (
        <div className="mt-1.5 flex flex-col gap-1">
          {rows.map((row, ri) => (
            <div key={ri} className="flex gap-1 flex-wrap">
              {row.map((btn, bi) => (
                <span key={bi} className="text-xs px-2 py-0.5 rounded-md bg-primary-50 text-primary-600 border border-primary-100">
                  {btn.text}
                </span>
              ))}
            </div>
          ))}
        </div>
      )
    } catch { return null }
  }

  /* ============================== JSX ============================== */

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">История чатов бота</h1>
          <p className="page-subtitle">{chatsTotal} диалогов</p>
        </div>
      </div>

      <div className="page-content">
        <div className="bg-white rounded-xl border border-gray-100 flex overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>

          {/* ===================== LEFT PANEL ===================== */}
          <div className={`flex-shrink-0 flex flex-col border-r border-gray-100 ${mobileListOpen ? 'flex' : 'hidden md:flex'} w-full md:w-[280px]`}>
            {/* search */}
            <div className="p-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
                  placeholder="Поиск пользователей..."
                  value={search}
                  onChange={e => onSearchChange(e.target.value)}
                />
              </div>
            </div>

            {/* list */}
            <div className="flex-1 overflow-y-auto">
              {chatsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                </div>
              ) : chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <MessageCircle className="w-8 h-8 mb-2" />
                  <p className="text-sm">Чаты не найдены</p>
                </div>
              ) : (
                chats.map(item => {
                  const active = activeUserId === item.user.id
                  return (
                    <button
                      key={item.user.id}
                      onClick={() => selectChat(item)}
                      className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-colors border-b border-gray-50 ${
                        active ? 'bg-primary-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                        active ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {initial(item.user)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-sm font-medium truncate ${active ? 'text-primary-700' : 'text-gray-900'}`}>
                            {displayName(item.user)}
                          </span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {fmtDate(item.lastDate)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {item.lastMessage}
                        </p>
                      </div>
                    </button>
                  )
                })
              )}

              {chats.length < chatsTotal && (
                <button
                  onClick={() => { const next = chatsPage + 1; setChatsPage(next); loadChats(next, search) }}
                  className="w-full text-center py-2.5 text-xs text-primary-600 hover:bg-primary-50 transition-colors"
                >
                  Загрузить ещё...
                </button>
              )}
            </div>
          </div>

          {/* ===================== MIDDLE PANEL ===================== */}
          <div className={`flex-1 flex flex-col min-w-0 ${!mobileListOpen ? 'flex' : 'hidden md:flex'}`}>
            {activeUser ? (
              <>
                {/* header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <button
                    className="md:hidden p-1 rounded-lg text-gray-400 hover:bg-gray-50"
                    onClick={() => { setMobileListOpen(true); setMobileProfileOpen(false) }}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-semibold flex-shrink-0 cursor-pointer md:cursor-default"
                       onClick={() => setMobileProfileOpen(true)}>
                    {initial(activeUser)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-gray-900 truncate cursor-pointer md:cursor-default"
                        onClick={() => setMobileProfileOpen(true)}>
                      {displayName(activeUser)}
                    </h2>
                    <p className="text-xs text-gray-400">{msgsTotal} сообщений</p>
                  </div>
                  <button className="md:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-50"
                          onClick={() => setMobileProfileOpen(o => !o)}>
                    <User className="w-4 h-4" />
                  </button>
                </div>

                {/* messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-gray-50/50">
                  {messages.length < msgsTotal && (
                    <div className="text-center py-2">
                      <button
                        onClick={() => loadMessages(activeUserId!, msgsPage + 1, true)}
                        disabled={msgsLoading}
                        className="text-xs px-3 py-1 rounded-lg text-primary-600 bg-primary-50 hover:bg-primary-100 transition-colors"
                      >
                        {msgsLoading ? 'Загрузка...' : 'Загрузить ранние'}
                      </button>
                    </div>
                  )}

                  {msgsLoading && messages.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <MessageCircle className="w-10 h-10 mb-2" />
                      <p className="text-sm">Нет сообщений</p>
                    </div>
                  ) : (
                    messages.map(msg => {
                      const isUser = msg.direction === 'IN'
                      return (
                        <div key={msg.id} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
                            isUser
                              ? 'bg-white border border-gray-100 rounded-bl-md'
                              : 'bg-primary-600 text-white rounded-br-md'
                          }`}>
                            <p className="text-[13px] whitespace-pre-wrap break-words">
                              {msg.text}
                            </p>
                            {isUser && renderButtons(msg.buttonsJson)}
                            <p className={`text-[10px] mt-1 ${isUser ? 'text-gray-400' : 'text-primary-200'}`}
                               style={{ textAlign: isUser ? 'left' : 'right' }}>
                              {new Date(msg.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* input */}
                <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 flex-shrink-0 bg-white">
                  <input
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
                    placeholder="Введите сообщение..."
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    disabled={sending}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!draft.trim() || sending}
                    className="p-2.5 rounded-lg bg-primary-600 text-white transition-all disabled:opacity-30 hover:bg-primary-700"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <div className="w-16 h-16 rounded-xl bg-primary-50 flex items-center justify-center mb-3">
                  <MessageCircle className="w-7 h-7 text-primary-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Выберите чат</h3>
                <p className="text-sm">Выберите пользователя слева для просмотра истории</p>
              </div>
            )}
          </div>

          {/* ===================== RIGHT PANEL ===================== */}
          {activeUser && (
            <>
              <div className="hidden md:flex flex-col w-[280px] flex-shrink-0 overflow-y-auto border-l border-gray-100">
                <ProfilePanel user={activeUser} />
              </div>
              {mobileProfileOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                  <div className="absolute inset-0 bg-black/40" onClick={() => setMobileProfileOpen(false)} />
                  <div className="absolute right-0 top-0 h-full w-[280px] max-w-[85vw] overflow-y-auto bg-white border-l border-gray-100">
                    <div className="flex items-center justify-between p-3 border-b border-gray-100">
                      <span className="text-sm font-semibold text-gray-900">Профиль</span>
                      <button onClick={() => setMobileProfileOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <ProfilePanel user={activeUser} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

/* ===================== Profile Panel ===================== */

function ProfilePanel({ user }: { user: ChatUser }) {
  return (
    <div className="p-4 space-y-5">
      <div className="flex flex-col items-center gap-2 pt-2">
        <div className="w-14 h-14 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-lg font-bold">
          {(user.telegramName || user.email || 'U')[0].toUpperCase()}
        </div>
        <h3 className="text-sm font-semibold text-gray-900 text-center">
          {user.telegramName || user.email?.split('@')[0] || `ID:${user.id.slice(0, 8)}`}
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge(user.subStatus)}`}>
          {user.subStatus}
        </span>
      </div>

      <div className="space-y-3">
        <ProfileRow icon={<User className="w-3.5 h-3.5" />} label="Telegram ID" value={user.telegramId || '---'} />
        {user.email && (
          <ProfileRow icon={<MessageCircle className="w-3.5 h-3.5" />} label="Email" value={user.email} />
        )}
        <ProfileRow icon={<Wallet className="w-3.5 h-3.5" />} label="Баланс" value={user.balance != null ? `${user.balance} RUB` : '---'} />
        <ProfileRow icon={<Gift className="w-3.5 h-3.5" />} label="Бонусные дни" value={user.bonusDays != null ? `${user.bonusDays}` : '---'} />
        <ProfileRow icon={<Calendar className="w-3.5 h-3.5" />} label="Регистрация" value={fmtFull(user.createdAt)} />
      </div>

      <Link
        href={`/admin/users/${user.id}`}
        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium bg-primary-50 text-primary-600 border border-primary-100 hover:bg-primary-100 transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Полный профиль
      </Link>
    </div>
  )
}

function ProfileRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-900 break-all">{value}</p>
      </div>
    </div>
  )
}

const statusBadge = (s: string) => {
  switch (s) {
    case 'ACTIVE':  return 'bg-green-50 text-green-700 border-green-100'
    case 'EXPIRED': return 'bg-red-50 text-red-700 border-red-100'
    case 'TRIAL':   return 'bg-blue-50 text-blue-700 border-blue-100'
    default:        return 'bg-gray-50 text-gray-500 border-gray-100'
  }
}
