import axios from 'axios'
import { config } from '../config'
import { logger } from '../utils/logger'

class RemnawaveService {
  private async getConfig() {
    // Always read from dynamic config (env + DB fallback)
    const url   = config.remnawave.url
    const token = config.remnawave.token
    return {
      baseURL: `${url.replace(/\/$/, '')}/api`,
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    }
  }

  get configured() { return config.remnawave.configured }

  async getUsers(params?: { offset?: number; limit?: number }) {
    const cfg = await this.getConfig()
    const { data } = await axios.get('/users', { ...cfg, params })
    return data
  }

  async getUserByUuid(uuid: string) {
    const cfg = await this.getConfig()
    const { data } = await axios.get(`/users/${uuid}`, cfg)
    return data.response ?? data
  }

  async getUserByTelegramId(tgId: string) {
    const cfg = await this.getConfig()
    const { data } = await axios.get(`/users/by-telegram-id/${tgId}`, cfg)
    return data.response ?? data
  }

  async getUserByEmail(email: string) {
    const cfg = await this.getConfig()
    const { data } = await axios.get(`/users/by-email/${encodeURIComponent(email)}`, cfg)
    return data.response ?? data
  }

  async createUser(params: {
    username: string; email?: string; telegramId?: number | null;
    expireAt: string; trafficLimitBytes: number;
    trafficLimitStrategy?: string; hwidDeviceLimit?: number;
    tag?: string; activeInternalSquads?: string[];
  }) {
    const cfg = await this.getConfig()
    const { data } = await axios.post('/users', params, cfg)
    return data.response ?? data
  }

  async deleteUser(uuid: string) {
    const cfg = await this.getConfig()
    await axios.delete(`/users/${uuid}`, cfg)
  }

  async getDevices(uuid: string) {
    const cfg = await this.getConfig()
    const { data } = await axios.get(`/users/${uuid}/devices`, cfg)
    return data.response ?? data
  }

  async revokeSubscription(uuid: string) {
    const cfg = await this.getConfig()
    const { data } = await axios.post(`/users/${uuid}/revoke-subscription`, {}, cfg)
    return data.response ?? data
  }

  async extendSubscription(uuid: string, days: number) {
    const cfg = await this.getConfig()
    const user = await this.getUserByUuid(uuid)
    const currentExpire = user.expireAt ? new Date(user.expireAt) : new Date()
    const base = currentExpire > new Date() ? currentExpire : new Date()
    const newExpire = new Date(base.getTime() + days * 86400_000)
    const { data } = await axios.patch(`/users/${uuid}`, { expireAt: newExpire.toISOString() }, cfg)
    return data.response ?? data
  }

  async deleteDevice(uuid: string, hwid: string) {
    const cfg = await this.getConfig()
    const { data } = await axios.delete(`/users/${uuid}/devices/${hwid}`, cfg)
    return data.response ?? data
  }

  getSubscriptionUrl(uuid: string, customUrl?: string) {
    const url = config.remnawave.url.replace(/\/$/, '')
    if (customUrl) return `${url}${customUrl}`
    return `${url}/sub/${uuid}`
  }

  async getHealth() {
    try {
      const cfg = await this.getConfig()
      const { data } = await axios.get('/system/stats', { ...cfg, timeout: 5000 })
      return { online: true, ...data }
    } catch {
      return { online: false }
    }
  }

  async getNodes() {
    try {
      const cfg = await this.getConfig()
      const { data } = await axios.get('/nodes', cfg)
      return data.response ?? data ?? []
    } catch { return [] }
  }
}

export const remnawave = new RemnawaveService()
