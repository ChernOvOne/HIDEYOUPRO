'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [needsFirstAdmin, setNeedsFirstAdmin] = useState(false)

  useEffect(() => {
    // Check if already logged in
    api.me()
      .then(() => router.push('/admin'))
      .catch(() => {
        // Check if first admin needs to be created
        api.setupStatus()
          .then(s => {
            if (!s.steps.admin_created) {
              setNeedsFirstAdmin(true)
              setMode('register')
            }
          })
          .catch(() => {})
      })
      .finally(() => setChecking(false))
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'register') {
        await api.register({ email, password, name })
        toast.success('Администратор создан!')
        router.push('/setup')
      } else {
        await api.login(email, password)
        // Check if setup is needed
        const status = await api.setupStatus()
        if (!status.steps.setup_complete) {
          router.push('/setup')
        } else {
          router.push('/admin')
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Ошибка')
    }
    setLoading(false)
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 text-white text-2xl font-bold mb-4">
            H
          </div>
          <h1 className="text-xl font-semibold">HIDEYOU PRO</h1>
          <p className="text-sm text-gray-400 mt-1">
            {needsFirstAdmin ? 'Создайте первого администратора' : 'Войдите в систему'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Имя</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Ваше имя" className="input" autoFocus
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com" className="input" required
              autoFocus={mode === 'login'}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Пароль</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Минимум 6 символов' : 'Введите пароль'}
              className="input" required minLength={mode === 'register' ? 6 : 1}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === 'register' ? 'Создать аккаунт' : 'Войти'}
          </button>
        </form>

        {!needsFirstAdmin && (
          <p className="text-center text-xs text-gray-400 mt-4">
            {mode === 'login' ? (
              <button onClick={() => setMode('register')} className="text-primary-600 hover:underline">
                Первая установка? Создать администратора
              </button>
            ) : (
              <button onClick={() => setMode('login')} className="text-primary-600 hover:underline">
                Уже есть аккаунт? Войти
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
