'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Shield, Plus, CreditCard, Users, Mail, MessageCircle,
  Copy, CheckCircle2, Clock, Trash2, Bell, RefreshCw, Ban,
  Calendar, Globe, FileText, DollarSign, ChevronDown, Wallet,
  Tag, Star, Loader2, KeyRound,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { adminApi } from '@/lib/api'

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [user, setUser]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing]   = useState(false)
  const [copied, setCopied]   = useState<string | null>(null)

  // Modals
  const [showExtend, setShowExtend]       = useState(false)
  const [showNote, setShowNote]           = useState(false)
  const [showBalance, setShowBalance]     = useState(false)
  const [showGrantDays, setShowGrantDays] = useState(false)
  const [showDelete, setShowDelete]       = useState(false)
  const [showResetPw, setShowResetPw]     = useState(false)
  const [showEditRole, setShowEditRole]   = useState(false)

  // Form state
  const [extendDays, setExtendDays]       = useState(30)
  const [noteText, setNoteText]           = useState('')
  const [balanceAmount, setBalanceAmount] = useState(0)
  const [balanceDesc, setBalanceDesc]     = useState('')
  const [grantDaysCount, setGrantDaysCount] = useState(30)
  const [grantDaysDesc, setGrantDaysDesc] = useState('')
  const [newPassword, setNewPassword]     = useState('')
  const [newRole, setNewRole]             = useState('')

  // Collapsible sections
  const [paymentsOpen, setPaymentsOpen]       = useState(true)
  const [referralsOpen, setReferralsOpen]     = useState(false)
  const [notesOpen, setNotesOpen]             = useState(true)
  const [variablesOpen, setVariablesOpen]     = useState(false)
  const [balanceTxOpen, setBalanceTxOpen]     = useState(false)

  const load = async () => {
    try {
      const u = await adminApi.get(`/users/${id}`)
      setUser(u)
    } catch {
      toast.error('Failed to load user')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
    toast.success('Copied')
  }

  const action = async (fn: () => Promise<any>, successMsg: string) => {
    setActing(true)
    try {
      await fn()
      toast.success(successMsg)
      await load()
    } catch (err: any) {
      toast.error(err.message || 'Error')
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
      <p className="text-gray-400 text-center py-12">User not found</p>
    </div>
  )

  const daysLeft = user.subExpireAt
    ? Math.max(0, Math.ceil((new Date(user.subExpireAt).getTime() - Date.now()) / 86400_000))
    : null

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
              {user.telegramName || user.email?.split('@')[0] || 'User'}
            </h1>
            <p className="page-subtitle font-mono">{user.id}</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button onClick={() => setShowExtend(true)} className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Days
          </button>
          <button onClick={() => setShowNote(true)} className="btn-default text-xs py-2 px-3 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Note
          </button>
          <button onClick={() => setShowBalance(true)} className="btn-default text-xs py-2 px-3 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Balance
          </button>
          <button onClick={() => setShowGrantDays(true)} className="btn-default text-xs py-2 px-3 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Bonus Days
          </button>
          <button onClick={() => { setNewRole(user.role); setShowEditRole(true) }} className="btn-default text-xs py-2 px-3 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Role
          </button>
          <button onClick={() => setShowResetPw(true)} className="btn-default text-xs py-2 px-3 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" /> Password
          </button>
          <button
            onClick={() => action(
              () => adminApi.post(`/users/${id}/toggle`),
              user.isActive ? 'User blocked' : 'User unblocked'
            )}
            className="text-xs py-2 px-3 flex items-center gap-1.5 rounded-lg border transition-colors bg-white border-red-200 text-red-500 hover:bg-red-50"
            disabled={acting}
          >
            <Ban className="w-3.5 h-3.5" />
            {user.isActive ? 'Block' : 'Unblock'}
          </button>
          <button onClick={() => setShowDelete(true)}
            className="text-xs py-2 px-3 flex items-center gap-1.5 rounded-lg border transition-colors bg-white border-red-200 text-red-500 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* ---- Left column: profile ---- */}
          <div className="space-y-5">
            {/* Profile card */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex flex-col items-center text-center mb-4">
                <div className="w-14 h-14 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center text-xl font-bold mb-3">
                  {(user.telegramName || user.email || 'U')[0].toUpperCase()}
                </div>
                <p className="font-semibold text-gray-900">
                  {user.telegramName || user.email?.split('@')[0] || 'No name'}
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
                {user.email && <CopyField label="Email" value={user.email} />}
                {user.telegramId && <CopyField label="Telegram ID" value={user.telegramId} />}
                {user.telegramName && <CopyField label="TG Username" value={`@${user.telegramName}`} />}
                {user.referralCode && <CopyField label="Referral Code" value={user.referralCode} />}
                {user.remnawaveUuid && <CopyField label="RW UUID" value={user.remnawaveUuid} />}
                <CopyField label="ID" value={user.id} />
              </div>

              <div className="space-y-1.5 border-t border-gray-100 pt-3 mt-3 text-xs text-gray-400">
                <p>Registered: {new Date(user.createdAt).toLocaleString('ru')}</p>
                {user.lastLoginAt && <p>Last login: {new Date(user.lastLoginAt).toLocaleString('ru')}</p>}
                {user.utmCode && <p>UTM: {user.utmCode}</p>}
              </div>
            </div>

            {/* KPI stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">LTV</p>
                <p className="text-lg font-semibold text-gray-900">{Number(user.totalPaid || 0).toLocaleString('ru')} &#8381;</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Balance</p>
                <p className="text-lg font-semibold text-gray-900">{Number(user.balance || 0)} &#8381;</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Bonus Days</p>
                <p className="text-lg font-semibold text-gray-900">{user.bonusDays || 0}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Referrals</p>
                <p className="text-lg font-semibold text-gray-900">{user._count?.referrals || 0}</p>
              </div>
            </div>

            {/* Subscription card */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary-600" /> Subscription
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={`font-medium ${user.subStatus === 'ACTIVE' ? 'text-emerald-600' : user.subStatus === 'EXPIRED' ? 'text-red-500' : 'text-gray-500'}`}>
                    {user.subStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Expires</span>
                  <span className="text-gray-900 font-medium">
                    {user.subExpireAt ? new Date(user.subExpireAt).toLocaleDateString('ru') : '--'}
                  </span>
                </div>
                {daysLeft !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Days left</span>
                    <span className={`font-medium ${daysLeft <= 3 ? 'text-red-500' : daysLeft <= 7 ? 'text-amber-500' : 'text-emerald-600'}`}>
                      {daysLeft}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Payments</span>
                  <span className="text-gray-900">{user._count?.payments || 0}</span>
                </div>
              </div>
            </div>

            {/* Referrals */}
            {user.referrals?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <SectionHeader
                  icon={<Users className="w-4 h-4 text-primary-600" />}
                  title="Referrals"
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
            {/* Payments */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionHeader
                icon={<CreditCard className="w-4 h-4 text-primary-600" />}
                title="Payment History"
                count={user.payments?.length}
                open={paymentsOpen}
                toggle={() => setPaymentsOpen(!paymentsOpen)}
              />
              {paymentsOpen && (
                <div className="mt-3">
                  {!user.payments?.length ? (
                    <p className="text-sm text-gray-400 py-4 text-center">No payments</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-[10px] uppercase tracking-wider text-gray-400 font-medium pb-2 pr-4">Amount</th>
                            <th className="text-left text-[10px] uppercase tracking-wider text-gray-400 font-medium pb-2 pr-4">Provider</th>
                            <th className="text-left text-[10px] uppercase tracking-wider text-gray-400 font-medium pb-2 pr-4">Status</th>
                            <th className="text-left text-[10px] uppercase tracking-wider text-gray-400 font-medium pb-2 pr-4">Purpose</th>
                            <th className="text-left text-[10px] uppercase tracking-wider text-gray-400 font-medium pb-2">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {user.payments.map((p: any) => (
                            <tr key={p.id} className="border-b border-gray-50 last:border-0">
                              <td className="py-2.5 pr-4 font-medium text-gray-900">
                                {Number(p.amount).toLocaleString('ru')} {p.currency || '&#8381;'}
                              </td>
                              <td className="py-2.5 pr-4 text-gray-500">{p.provider || '--'}</td>
                              <td className="py-2.5 pr-4">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  p.status === 'PAID' ? 'text-emerald-600 bg-emerald-50' :
                                  p.status === 'PENDING' ? 'text-amber-600 bg-amber-50' :
                                  'text-gray-500 bg-gray-100'
                                }`}>{p.status}</span>
                              </td>
                              <td className="py-2.5 pr-4 text-gray-500">{p.purpose || '--'}</td>
                              <td className="py-2.5 text-gray-400 text-xs">{new Date(p.createdAt).toLocaleDateString('ru')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Balance transactions */}
            {user.balanceTransactions?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <SectionHeader
                  icon={<Wallet className="w-4 h-4 text-primary-600" />}
                  title="Balance History"
                  count={user.balanceTransactions.length}
                  open={balanceTxOpen}
                  toggle={() => setBalanceTxOpen(!balanceTxOpen)}
                />
                {balanceTxOpen && (
                  <div className="mt-3 space-y-1">
                    {user.balanceTransactions.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <p className="text-sm text-gray-900">{tx.description || tx.type || 'Transaction'}</p>
                          <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleString('ru')}</p>
                        </div>
                        <span className={`text-sm font-medium ${Number(tx.amount) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {Number(tx.amount) >= 0 ? '+' : ''}{Number(tx.amount)} &#8381;
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bonus history */}
            {user.bonusHistory?.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <SectionHeader
                  icon={<Star className="w-4 h-4 text-primary-600" />}
                  title="Bonus History"
                  count={user.bonusHistory.length}
                  open={false}
                  toggle={() => {}}
                />
                <div className="mt-3 space-y-1">
                  {user.bonusHistory.map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm text-gray-900">{b.reason || 'Bonus'}</p>
                        <p className="text-xs text-gray-400">{new Date(b.appliedAt).toLocaleString('ru')}</p>
                      </div>
                      <span className="text-sm font-medium text-primary-600">+{b.days} days</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Notes */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <SectionHeader
                icon={<FileText className="w-4 h-4 text-primary-600" />}
                title="Admin Notes"
                count={user.adminNotesOnUser?.length}
                open={notesOpen}
                toggle={() => setNotesOpen(!notesOpen)}
              />
              {notesOpen && (
                <div className="mt-3">
                  {!user.adminNotesOnUser?.length ? (
                    <p className="text-sm text-gray-400 py-4 text-center">No notes</p>
                  ) : (
                    <div className="space-y-2">
                      {user.adminNotesOnUser.map((note: any) => (
                        <div key={note.id} className="flex items-start justify-between p-3 rounded-lg bg-gray-50">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-900">{note.note}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {note.author?.telegramName || 'Admin'} &middot; {new Date(note.createdAt).toLocaleString('ru')}
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
                  <Tag className="w-4 h-4 text-primary-600" /> Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {user.userTags.map((t: any) => (
                    <span key={t.id} className="badge-info flex items-center gap-1">
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
                  title="Variables"
                  count={user.userVariables.length}
                  open={variablesOpen}
                  toggle={() => setVariablesOpen(!variablesOpen)}
                />
                {variablesOpen && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-[10px] uppercase tracking-wider text-gray-400 font-medium pb-2 pr-4">Key</th>
                          <th className="text-left text-[10px] uppercase tracking-wider text-gray-400 font-medium pb-2">Value</th>
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
        <ModalOverlay onClose={() => setShowExtend(false)} title="Add Subscription Days">
          <input type="number" className="input w-full" placeholder="Number of days"
            value={extendDays} onChange={e => setExtendDays(+e.target.value)} min={1} />
          <button onClick={() => {
            action(() => adminApi.post(`/users/${id}/add-days`, { days: extendDays }), `+${extendDays} days`)
            setShowExtend(false)
          }} className="btn-primary w-full justify-center" disabled={acting}>
            +{extendDays} days
          </button>
        </ModalOverlay>
      )}

      {/* Add note */}
      {showNote && (
        <ModalOverlay onClose={() => setShowNote(false)} title="Add Note">
          <textarea className="input w-full min-h-[80px] resize-y" placeholder="Note text..."
            value={noteText} onChange={e => setNoteText(e.target.value)} />
          <button onClick={() => {
            action(() => adminApi.post(`/users/${id}/note`, { note: noteText }), 'Note added')
            setShowNote(false); setNoteText('')
          }} className="btn-primary w-full justify-center" disabled={acting || !noteText}>
            Save Note
          </button>
        </ModalOverlay>
      )}

      {/* Adjust balance */}
      {showBalance && (
        <ModalOverlay onClose={() => setShowBalance(false)} title="Adjust Balance">
          <p className="text-sm text-gray-500">
            Current balance: <strong className="text-gray-900">{Number(user.balance || 0).toFixed(2)} &#8381;</strong>
          </p>
          <input type="number" className="input w-full" placeholder="Amount (+ top up, - deduct)"
            value={balanceAmount} onChange={e => setBalanceAmount(+e.target.value)} />
          <input className="input w-full" placeholder="Description"
            value={balanceDesc} onChange={e => setBalanceDesc(e.target.value)} />
          <button onClick={() => {
            action(
              () => adminApi.put(`/users/${id}`, { balance: Number(user.balance || 0) + balanceAmount }),
              'Balance updated'
            )
            setShowBalance(false); setBalanceAmount(0); setBalanceDesc('')
          }} className="btn-primary w-full justify-center" disabled={acting || balanceAmount === 0}>
            {balanceAmount >= 0 ? `+${balanceAmount}` : `${balanceAmount}`} &#8381;
          </button>
        </ModalOverlay>
      )}

      {/* Grant bonus days */}
      {showGrantDays && (
        <ModalOverlay onClose={() => setShowGrantDays(false)} title="Grant Bonus Days">
          <p className="text-sm text-gray-500">
            Current bonus days: <strong className="text-gray-900">{user.bonusDays ?? 0}</strong>
          </p>
          <input type="number" className="input w-full" placeholder="Number of days"
            value={grantDaysCount} onChange={e => setGrantDaysCount(+e.target.value)} min={1} />
          <input className="input w-full" placeholder="Description (optional)"
            value={grantDaysDesc} onChange={e => setGrantDaysDesc(e.target.value)} />
          <button onClick={() => {
            action(
              () => adminApi.put(`/users/${id}`, { bonusDays: (user.bonusDays || 0) + grantDaysCount }),
              `+${grantDaysCount} bonus days`
            )
            setShowGrantDays(false); setGrantDaysCount(30); setGrantDaysDesc('')
          }} className="btn-primary w-full justify-center" disabled={acting || grantDaysCount < 1}>
            +{grantDaysCount} bonus days
          </button>
        </ModalOverlay>
      )}

      {/* Reset password */}
      {showResetPw && (
        <ModalOverlay onClose={() => setShowResetPw(false)} title="Reset Password">
          <input type="password" className="input w-full" placeholder="New password (min 6 chars)"
            value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <button onClick={() => {
            action(
              () => adminApi.post(`/users/${id}/reset-password`, { password: newPassword }),
              'Password reset'
            )
            setShowResetPw(false); setNewPassword('')
          }} className="btn-primary w-full justify-center" disabled={acting || newPassword.length < 6}>
            Reset Password
          </button>
        </ModalOverlay>
      )}

      {/* Edit role */}
      {showEditRole && (
        <ModalOverlay onClose={() => setShowEditRole(false)} title="Change Role">
          <select className="input w-full" value={newRole} onChange={e => setNewRole(e.target.value)}>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="EDITOR">EDITOR</option>
            <option value="INVESTOR">INVESTOR</option>
          </select>
          <button onClick={() => {
            action(
              () => adminApi.put(`/users/${id}`, { role: newRole }),
              `Role changed to ${newRole}`
            )
            setShowEditRole(false)
          }} className="btn-primary w-full justify-center" disabled={acting}>
            Save Role
          </button>
        </ModalOverlay>
      )}

      {/* Delete confirmation */}
      {showDelete && (
        <ModalOverlay onClose={() => setShowDelete(false)} title="Delete User">
          <p className="text-sm text-gray-500">
            Are you sure you want to permanently delete <strong className="text-gray-900">{user.telegramName || user.email || user.id}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setShowDelete(false)} className="btn-default flex-1 justify-center">
              Cancel
            </button>
            <button onClick={() => {
              action(
                () => adminApi.delete(`/users/${id}`),
                'User deleted'
              ).then(() => router.push('/admin/users'))
              setShowDelete(false)
            }} className="flex-1 py-2 px-4 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors text-center"
              disabled={acting}>
              Delete
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
