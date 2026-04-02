import axios from 'axios'
import { config } from '../config'
import { logger } from '../utils/logger'

class RemnawaveService {
  private async getConfig() {
    const url   = config.remnawave.url
    const token = config.remnawave.token
    return {
      baseURL: `${url.replace(/\/$/, '')}/api`,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    }
  }

  private unwrap(data: any): any {
    return data?.response ?? data
  }

  get configured() { return config.remnawave.configured }

  // ── Users: basic CRUD ─────────────────────────────────────────

  async getUserByUuid(uuid: string) {
    const cfg = await this.getConfig()
    const { data } = await axios.get(`/users/${uuid}`, cfg)
    const result = this.unwrap(data)
    return Array.isArray(result) ? result[0] : result
  }

  async getUserByTelegramId(tgId: string) {
    if (!this.configured) return null
    try {
      const tgIdNum = parseInt(tgId, 10)
      if (isNaN(tgIdNum)) return null
      const cfg = await this.getConfig()
      const { data } = await axios.get(`/users/get-by-telegram-id/${tgIdNum}`, cfg)
      const result = this.unwrap(data)
      if (Array.isArray(result)) return this.pickBestUser(result)
      return result ?? null
    } catch (e: any) {
      if (e.response?.status === 404) return null
      logger.debug(`getUserByTelegramId failed: ${e.message}`)
      return null
    }
  }

  async getUserByEmail(email: string) {
    if (!this.configured) return null
    try {
      const cfg = await this.getConfig()
      const { data } = await axios.get(`/users/get-by-email/${encodeURIComponent(email)}`, cfg)
      const result = this.unwrap(data)
      if (Array.isArray(result)) return this.pickBestUser(result)
      return result ?? null
    } catch (e: any) {
      if (e.response?.status === 404) return null
      // Fallback: search in all users
      try {
        const { users } = await this.getAllUsers(0, 100)
        const matched = users.filter((u: any) => u.email === email)
        return this.pickBestUser(matched)
      } catch { return null }
    }
  }

  /** Pick best subscription: prefer ACTIVE with latest expiry */
  private pickBestUser(users: any[]): any | null {
    if (!users.length) return null
    if (users.length === 1) return users[0]
    const active = users.filter((u: any) => u.status === 'ACTIVE')
    const pool   = active.length ? active : users
    return pool.reduce((best: any, u: any) => {
      const bDate = best.expireAt ? new Date(best.expireAt).getTime() : 0
      const uDate = u.expireAt    ? new Date(u.expireAt).getTime()    : 0
      return uDate > bDate ? u : best
    })
  }

  async getAllUsers(start = 0, size = 25) {
    const cfg = await this.getConfig()
    const { data } = await axios.get('/users', { ...cfg, params: { start, size } })
    const result = this.unwrap(data)
    return {
      users: Array.isArray(result) ? result : (result.users ?? []),
      total: result.total ?? 0,
    }
  }

  async createUser(params: {
    username: string; email?: string; telegramId?: number | null;
    expireAt: string; trafficLimitBytes?: number;
    trafficLimitStrategy?: string; hwidDeviceLimit?: number;
    tag?: string; activeInternalSquads?: string[];
  }) {
    const cfg = await this.getConfig()
    const { data } = await axios.post('/users', params, cfg)
    return this.unwrap(data)
  }

  async updateUser(payload: Record<string, any>) {
    const cfg = await this.getConfig()
    const { data } = await axios.patch('/users', payload, cfg)
    return this.unwrap(data)
  }

  async enableUser(uuid: string) {
    return this.updateUser({ uuid, status: 'ACTIVE' })
  }

  async disableUser(uuid: string) {
    return this.updateUser({ uuid, status: 'DISABLED' })
  }

  async deleteUser(uuid: string) {
    const cfg = await this.getConfig()
    await axios.delete(`/users/${uuid}`, cfg)
    logger.info(`REMNAWAVE user deleted: ${uuid}`)
  }

  // ── Subscription management ───────────────────────────────────

  async extendSubscription(uuid: string, days: number) {
    const user = await this.getUserByUuid(uuid)
    const currentExpire = user.expireAt ? new Date(user.expireAt) : new Date()
    const base = currentExpire > new Date() ? currentExpire : new Date()
    base.setDate(base.getDate() + days)
    return this.updateUser({ uuid, expireAt: base.toISOString(), status: 'ACTIVE' })
  }

  async revokeSubscription(uuid: string) {
    const cfg = await this.getConfig()
    const { data } = await axios.post(`/users/${uuid}/actions/revoke`, {
      revokeOnlyPasswords: false,
    }, cfg)
    return this.unwrap(data)
  }

  /** Full sync — returns detailed subscription status for dashboard */
  async syncUserSubscription(remnawaveUuid: string) {
    try {
      const rm = await this.getUserByUuid(remnawaveUuid)
      const usedBytes  = rm.userTraffic?.usedTrafficBytes ?? 0
      const limitBytes = rm.trafficLimitBytes > 0 ? rm.trafficLimitBytes : null

      let daysLeft: number | null = null
      if (rm.expireAt) {
        daysLeft = Math.max(0, Math.ceil((new Date(rm.expireAt).getTime() - Date.now()) / 86_400_000))
      }

      let trafficUsedPercent: number | null = null
      if (limitBytes && limitBytes > 0) {
        trafficUsedPercent = Math.min(100, Math.round(usedBytes / limitBytes * 100))
      }

      return {
        status:             rm.status,
        expireAt:           rm.expireAt,
        usedTrafficBytes:   usedBytes,
        trafficLimitBytes:  limitBytes,
        subscriptionUrl:    this.getSubscriptionUrl(rm.uuid, rm.subscriptionUrl),
        onlineAt:           rm.userTraffic?.onlineAt ?? null,
        subLastOpenedAt:    rm.subLastOpenedAt,
        subLastUserAgent:   rm.subLastUserAgent,
        daysLeft,
        trafficUsedPercent,
        activeSquads:       rm.activeInternalSquads ?? [],
      }
    } catch { return null }
  }

  // ── HWID Devices ──────────────────────────────────────────────

  async getDevices(uuid: string) {
    const cfg = await this.getConfig()
    const { data } = await axios.get(`/hwid/devices/${uuid}`, cfg)
    const result = this.unwrap(data)
    return { devices: result.devices ?? result ?? [], total: result.total ?? 0 }
  }

  async deleteDevice(userUuid: string, hwid: string) {
    const cfg = await this.getConfig()
    await axios.post('/hwid/devices/delete', { userUuid, hwid }, cfg)
  }

  // ── Actions ───────────────────────────────────────────────────

  async resetTrafficAction(uuid: string) {
    const cfg = await this.getConfig()
    const { data } = await axios.post(`/users/${uuid}/actions/reset-traffic`, {}, cfg)
    return this.unwrap(data)
  }

  async disableUserAction(uuid: string) {
    const cfg = await this.getConfig()
    const { data } = await axios.post(`/users/${uuid}/actions/disable`, {}, cfg)
    return this.unwrap(data)
  }

  // ── Squads ────────────────────────────────────────────────────

  async getInternalSquads() {
    try {
      const cfg = await this.getConfig()
      const { data } = await axios.get('/internal-squads', cfg)
      const result = this.unwrap(data)
      return { squads: result.internalSquads ?? [], total: result.total ?? 0 }
    } catch { return { squads: [], total: 0 } }
  }

  // ── Tags ──────────────────────────────────────────────────────

  async getUsersByTag(tag: string) {
    if (!this.configured) return []
    try {
      const cfg = await this.getConfig()
      const { data } = await axios.get(`/users/by-tag/${encodeURIComponent(tag)}`, cfg)
      const result = this.unwrap(data)
      return Array.isArray(result) ? result : []
    } catch { return [] }
  }

  // ── Find or create ────────────────────────────────────────────

  async findOrCreateUser(params: {
    email?:      string
    telegramId?: string
    username:    string
    expireAt?:   string
    squads?:     string[]
  }): Promise<{ user: any; created: boolean }> {
    let existing = null
    if (params.email) existing = await this.getUserByEmail(params.email)
    if (!existing && params.telegramId) existing = await this.getUserByTelegramId(params.telegramId)
    if (existing) return { user: existing, created: false }

    const user = await this.createUser({
      username:             params.username,
      email:                params.email      ?? undefined,
      telegramId:           params.telegramId ? parseInt(params.telegramId, 10) : null,
      expireAt:             params.expireAt   ?? new Date().toISOString(),
      activeInternalSquads: params.squads     ?? [],
    })
    return { user, created: true }
  }

  // ── Subscription URL ──────────────────────────────────────────

  getSubscriptionUrl(uuid: string, customUrl?: string | null) {
    const url = config.remnawave.url.replace(/\/$/, '')
    if (customUrl) return customUrl.startsWith('http') ? customUrl : `${url}${customUrl}`
    return `${url}/sub/${uuid}`
  }

  // ── System monitoring ─────────────────────────────────────────

  async getHealth() {
    try {
      const cfg = await this.getConfig()
      const { data } = await axios.get('/system/stats', { ...cfg, timeout: 5000 })
      return { online: true, ...this.unwrap(data) }
    } catch {
      return { online: false }
    }
  }

  async getSystemStats() {
    try {
      const cfg = await this.getConfig()
      const { data } = await axios.get('/system/stats', cfg)
      return this.unwrap(data)
    } catch { return null }
  }

  async getNodesMetrics() {
    try {
      const cfg = await this.getConfig()
      const { data } = await axios.get('/system/nodes/metrics', cfg)
      return this.unwrap(data)
    } catch { return null }
  }

  async getNodes() {
    try {
      const cfg = await this.getConfig()
      const { data } = await axios.get('/nodes', cfg)
      return this.unwrap(data) ?? []
    } catch { return [] }
  }
}

export const remnawave = new RemnawaveService()
