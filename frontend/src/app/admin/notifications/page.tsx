'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Bell, Plus, Trash2, Send, Loader2, ToggleLeft,
  Hash, AlertCircle, CheckCircle2, X,
} from 'lucide-react'
import toast from 'react-hot-toast'

/* ── Types ─────────────────────────────────────────────────── */

interface NotificationChannel {
  id: string
  name: string
  chatId: string
  events: string[]
  enabled: boolean
  createdAt: string
}

const ALL_EVENTS = [
  { key: 'payments',      label: 'Payments' },
  { key: 'new_users',     label: 'New users' },
  { key: 'expenses',      label: 'Expenses' },
  { key: 'server_alerts', label: 'Server alerts' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'errors',        label: 'Errors' },
]

const apiFetch = async (path: string, opts?: RequestInit) => {
  const res = await fetch(`/api/admin/extras/notification-channels${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

/* ── Component ─────────────────────────────────────────────── */

export default function NotificationsPage() {
  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)

  /* form state */
  const [formName, setFormName]     = useState('')
  const [formChatId, setFormChatId] = useState('')
  const [formEvents, setFormEvents] = useState<string[]>(['payments', 'new_users'])
  const [formSaving, setFormSaving] = useState(false)

  const [testingId, setTestingId]   = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /* ── Load ──────────────────────────────────────────────── */

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch('')
      setChannels(data.channels || data || [])
    } catch {
      toast.error('Failed to load notification channels')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /* ── Add ───────────────────────────────────────────────── */

  const addChannel = async () => {
    if (!formName.trim() || !formChatId.trim()) {
      toast.error('Name and Chat ID are required')
      return
    }
    setFormSaving(true)
    try {
      await apiFetch('', {
        method: 'POST',
        body: JSON.stringify({ name: formName.trim(), chatId: formChatId.trim(), events: formEvents }),
      })
      toast.success('Channel added')
      setFormName('')
      setFormChatId('')
      setFormEvents(['payments', 'new_users'])
      setShowAdd(false)
      load()
    } catch (err: any) {
      toast.error(err.message || 'Failed to add channel')
    } finally {
      setFormSaving(false)
    }
  }

  /* ── Toggle event ──────────────────────────────────────── */

  const toggleEvent = async (channel: NotificationChannel, eventKey: string) => {
    const newEvents = channel.events.includes(eventKey)
      ? channel.events.filter(e => e !== eventKey)
      : [...channel.events, eventKey]

    try {
      await apiFetch(`/${channel.id}`, {
        method: 'PUT',
        body: JSON.stringify({ events: newEvents }),
      })
      setChannels(prev => prev.map(c =>
        c.id === channel.id ? { ...c, events: newEvents } : c
      ))
    } catch {
      toast.error('Failed to update')
    }
  }

  /* ── Toggle enabled ────────────────────────────────────── */

  const toggleEnabled = async (channel: NotificationChannel) => {
    try {
      await apiFetch(`/${channel.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !channel.enabled }),
      })
      setChannels(prev => prev.map(c =>
        c.id === channel.id ? { ...c, enabled: !c.enabled } : c
      ))
    } catch {
      toast.error('Failed to toggle')
    }
  }

  /* ── Test ──────────────────────────────────────────────── */

  const testChannel = async (id: string) => {
    setTestingId(id)
    try {
      await apiFetch(`/${id}/test`, { method: 'POST' })
      toast.success('Test message sent')
    } catch {
      toast.error('Failed to send test')
    } finally {
      setTestingId(null)
    }
  }

  /* ── Delete ────────────────────────────────────────────── */

  const deleteChannel = async (id: string) => {
    if (!confirm('Delete this notification channel?')) return
    setDeletingId(id)
    try {
      await apiFetch(`/${id}`, { method: 'DELETE' })
      toast.success('Channel deleted')
      setChannels(prev => prev.filter(c => c.id !== id))
    } catch {
      toast.error('Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  /* ── Event checkbox helper ─────────────────────────────── */

  const toggleFormEvent = (key: string) => {
    setFormEvents(prev =>
      prev.includes(key) ? prev.filter(e => e !== key) : [...prev, key]
    )
  }

  /* ── Render ────────────────────────────────────────────── */

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">Manage notification channels for alerts</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
        >
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAdd ? 'Cancel' : 'Add Channel'}
        </button>
      </div>

      <div className="page-content">
        <div className="max-w-3xl space-y-5">

          {/* ── Add form ──────────────────────────────────── */}
          {showAdd && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">New Notification Channel</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Channel Name</label>
                  <input
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. Payment Alerts"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Telegram Chat ID</label>
                  <input
                    value={formChatId}
                    onChange={e => setFormChatId(e.target.value)}
                    placeholder="-1001234567890"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Use @userinfobot or forward a message to @RawDataBot to get the chat ID
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Events</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_EVENTS.map(evt => (
                      <button
                        key={evt.key}
                        onClick={() => toggleFormEvent(evt.key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          formEvents.includes(evt.key)
                            ? 'bg-primary-50 text-primary-700 border-primary-200'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {evt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={addChannel}
                  disabled={formSaving}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {formSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add Channel
                </button>
              </div>
            </div>
          )}

          {/* ── Channels list ─────────────────────────────── */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            </div>
          ) : channels.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No channels yet</h3>
              <p className="text-xs text-gray-400">Add a Telegram chat or group to receive notifications</p>
            </div>
          ) : (
            channels.map(channel => (
              <div key={channel.id} className="bg-white rounded-xl border border-gray-100 p-5">
                {/* header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      channel.enabled ? 'bg-primary-50 text-primary-600' : 'bg-gray-50 text-gray-400'
                    }`}>
                      <Hash className="w-[18px] h-[18px]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{channel.name}</h3>
                      <p className="text-xs text-gray-400 font-mono">{channel.chatId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleEnabled(channel)}
                      className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                        channel.enabled ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                        style={{ transform: channel.enabled ? 'translateX(20px)' : 'translateX(0)' }}
                      />
                    </button>
                  </div>
                </div>

                {/* events */}
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Subscribed Events</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_EVENTS.map(evt => {
                      const active = channel.events.includes(evt.key)
                      return (
                        <button
                          key={evt.key}
                          onClick={() => toggleEvent(channel, evt.key)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                            active
                              ? 'bg-green-50 text-green-700 border-green-100'
                              : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          {active && <CheckCircle2 className="w-3 h-3 inline mr-1 -mt-0.5" />}
                          {evt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
                  <button
                    onClick={() => testChannel(channel.id)}
                    disabled={testingId === channel.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-50 text-primary-600 border border-primary-100 hover:bg-primary-100 transition-colors disabled:opacity-50"
                  >
                    {testingId === channel.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Test
                  </button>
                  <span className="text-xs text-gray-300 flex-1">
                    Added {new Date(channel.createdAt).toLocaleDateString('en')}
                  </span>
                  <button
                    onClick={() => deleteChannel(channel.id)}
                    disabled={deletingId === channel.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deletingId === channel.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
