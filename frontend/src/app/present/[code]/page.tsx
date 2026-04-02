'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Gift, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import Link from 'next/link'

interface GiftInfo {
  status: string
  tariffName: string
  message?: string
  senderName?: string
  expiresAt?: string
}

export default function PresentPage() {
  const { code } = useParams<{ code: string }>()
  const [status, setStatus] = useState<'loading' | 'checking' | 'success' | 'error' | 'login'>('loading')
  const [giftInfo, setGiftInfo] = useState<GiftInfo | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) return

    fetch(`/api/gifts/status/${code}`)
      .then(r => r.json())
      .then(info => {
        if (info.error || info.status !== 'PENDING') {
          setError(info.status === 'CLAIMED' ? 'Подарок уже активирован' : info.error || 'Подарок недоступен')
          setStatus('error')
          return
        }
        setGiftInfo(info)
        setStatus('checking')

        return fetch(`/api/gifts/claim/${code}`, { method: 'POST', credentials: 'include' })
          .then(r => {
            if (r.status === 401) { setStatus('login'); return null }
            return r.json()
          })
          .then(d => {
            if (!d) return
            if (d?.ok) setStatus('success')
            else { setError(d?.error || 'Ошибка активации'); setStatus('error') }
          })
      })
      .catch(() => { setError('Подарок не найден'); setStatus('error') })
  }, [code])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-950">
      <div className="w-full max-w-md">
        {/* Loading */}
        {(status === 'loading' || status === 'checking') && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-10 text-center space-y-6">
            <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mx-auto" />
            <p className="text-gray-300">{status === 'loading' ? 'Загрузка подарка...' : 'Активация...'}</p>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-10 text-center space-y-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <div>
              <p className="text-xl font-bold text-white">Подарок активирован!</p>
              {giftInfo && <p className="text-sm mt-2 text-gray-400">Тариф <span className="text-cyan-400 font-semibold">{giftInfo.tariffName}</span> подключён</p>}
              {giftInfo?.senderName && <p className="text-sm mt-1 text-gray-500">От {giftInfo.senderName}</p>}
              {giftInfo?.message && (
                <div className="mt-4 p-3 rounded-xl bg-cyan-500/5 border border-gray-800 text-sm text-gray-400 italic">
                  &laquo;{giftInfo.message}&raquo;
                </div>
              )}
            </div>
            <Link href="/dashboard" className="inline-block px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-semibold transition">
              Перейти в кабинет
            </Link>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-10 text-center space-y-6">
            <XCircle className="w-12 h-12 text-red-400 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-white">{error}</p>
              <p className="text-sm mt-1 text-gray-500">Возможно, подарок уже использован или срок истёк</p>
            </div>
            <Link href="/" className="inline-block px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition">
              На главную
            </Link>
          </div>
        )}

        {/* Login needed */}
        {status === 'login' && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-10 text-center space-y-6">
            <Gift className="w-12 h-12 text-cyan-400 mx-auto" />
            <div>
              <p className="text-xl font-bold text-white">Вам подарок!</p>
              {giftInfo && <p className="text-sm mt-2 text-gray-400">Тариф <span className="text-cyan-400 font-semibold">{giftInfo.tariffName}</span></p>}
              {giftInfo?.senderName && <p className="text-sm mt-1 text-gray-500">От {giftInfo.senderName}</p>}
              {giftInfo?.message && (
                <div className="mt-4 p-3 rounded-xl bg-cyan-500/5 border border-gray-800 text-sm text-gray-400 italic">
                  &laquo;{giftInfo.message}&raquo;
                </div>
              )}
            </div>
            <p className="text-sm text-gray-400">Войдите или зарегистрируйтесь, чтобы получить подарок</p>
            <div className="flex gap-3">
              <Link href={`/login?gift=${code}`} className="flex-1 py-3 text-center bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-semibold text-sm transition">Войти</Link>
              <Link href={`/login?gift=${code}`} className="flex-1 py-3 text-center bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition">Регистрация</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
