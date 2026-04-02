const BASE = process.env.NEXT_PUBLIC_API_URL || '/api'

async function apiFetch<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
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

export const api = {
  // Auth
  login:    (email: string, password: string) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data: { email: string; password: string; name?: string }) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me:       () => apiFetch('/auth/me'),
  logout:   () => apiFetch('/auth/logout', { method: 'POST' }),

  // Setup
  setupStatus:   () => apiFetch('/setup/status'),
  setupCompany:  (data: any) => apiFetch('/setup/company', { method: 'POST', body: JSON.stringify(data) }),
  setupRemnawave:(data: any) => apiFetch('/setup/remnawave', { method: 'POST', body: JSON.stringify(data) }),
  setupTelegram: (data: any) => apiFetch('/setup/telegram', { method: 'POST', body: JSON.stringify(data) }),
  setupPayments: (data: any) => apiFetch('/setup/payments', { method: 'POST', body: JSON.stringify(data) }),
  setupComplete: () => apiFetch('/setup/complete', { method: 'POST' }),

  // Admin
  stats:    () => apiFetch('/admin/stats'),
  settings: () => apiFetch('/admin/settings'),
  updateSettings: (data: Record<string, string>) => apiFetch('/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
}

// Admin API helper (used by HideYou-ported pages)
export const adminApi = {
  get:    <T = any>(path: string) => apiFetch<T>(`/admin${path}`),
  post:   <T = any>(path: string, data?: any) => apiFetch<T>(`/admin${path}`, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put:    <T = any>(path: string, data?: any) => apiFetch<T>(`/admin${path}`, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  delete: <T = any>(path: string) => apiFetch<T>(`/admin${path}`, { method: 'DELETE' }),
  upload: async (path: string, formData: FormData) => {
    const res = await fetch(`${BASE}/admin${path}`, { method: 'POST', credentials: 'include', body: formData })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  },

  // News
  news:        (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return apiFetch(`/admin/news${qs}`)
  },
  createNews:  (d: any) => apiFetch('/admin/news', { method: 'POST', body: JSON.stringify(d) }),
  updateNews:  (id: string, d: any) => apiFetch(`/admin/news/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteNews:  (id: string) => apiFetch(`/admin/news/${id}`, { method: 'DELETE' }),
  publishNews: (id: string) => apiFetch(`/admin/news/${id}/publish`, { method: 'POST' }),

  // Promos
  promos:      () => apiFetch('/admin/marketing/promos'),
  tariffs:     () => apiFetch('/admin/tariffs'),
  createPromo: (d: any) => apiFetch('/admin/marketing/promos', { method: 'POST', body: JSON.stringify(d) }),
  updatePromo: (id: string, d: any) => apiFetch(`/admin/marketing/promos/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deletePromo: (id: string) => apiFetch(`/admin/marketing/promos/${id}`, { method: 'DELETE' }),
  promoStats:  (id: string) => apiFetch(`/admin/marketing/promos/${id}/stats`),

  // Proxies
  proxies:      () => apiFetch('/admin/proxies'),
  createProxy:  (d: any) => apiFetch('/admin/proxies', { method: 'POST', body: JSON.stringify(d) }),
  updateProxy:  (id: string, d: any) => apiFetch(`/admin/proxies/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteProxy:  (id: string) => apiFetch(`/admin/proxies/${id}`, { method: 'DELETE' }),

  // Import
  importStatus: () => apiFetch('/admin/import/status'),
}

// User-facing API
export const userApi = {
  subscription: () => apiFetch('/user/subscription'),
  devices:      () => apiFetch('/user/devices'),
  sync:         () => apiFetch('/user/sync', { method: 'POST' }),
  deleteDevice: (id: string) => apiFetch(`/user/devices/${id}`, { method: 'DELETE' }),
  payments:     (p?: any) => apiFetch('/payments/user'),
  referral:     () => apiFetch('/user/referral'),
  profile:      () => apiFetch('/user/profile'),
  updateProfile:(d: any) => apiFetch('/user/profile', { method: 'PUT', body: JSON.stringify(d) }),
}

// Promo API
export const promoApi = {
  check:    (code: string) => apiFetch(`/user/promo/check`, { method: 'POST', body: JSON.stringify({ code }) }),
  activate: (code: string) => apiFetch(`/user/promo/activate`, { method: 'POST', body: JSON.stringify({ code }) }),
}

// Auth API
export const authApi = {
  login:       (email: string, password: string) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register:    (d: any) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(d) }),
  me:          () => apiFetch('/auth/me'),
  logout:      () => apiFetch('/auth/logout', { method: 'POST' }),
  tma:         (initData: string) => apiFetch('/auth/tma', { method: 'POST', body: JSON.stringify({ initData }) }),
  changePassword: (current: string, newPw?: string) => apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify(typeof current === 'object' ? current : { currentPassword: current, newPassword: newPw }) }),
  linkEmail:      (d: any) => apiFetch('/auth/link-email', { method: 'POST', body: JSON.stringify(d) }),
  linkTelegram:   (d: any) => apiFetch('/auth/link-telegram', { method: 'POST', body: JSON.stringify(d) }),
  resetPassword:  (email: string, code: string, newPassword: string) => apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, newPassword }) }),
}

// Verification API
export const verificationApi = {
  sendCode:    (email: string, type?: string) => apiFetch('/verification/send', { method: 'POST', body: JSON.stringify({ email, type }) }),
  verify:      (email: string, code: string, type?: string) => apiFetch('/verification/verify', { method: 'POST', body: JSON.stringify({ email, code, type }) }),
}
