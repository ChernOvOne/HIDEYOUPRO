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
