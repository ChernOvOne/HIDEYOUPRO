import axios from 'axios'
import { config } from '../config'
import { logger } from '../utils/logger'
import { prisma } from '../db'

class RemnawaveService {
  private baseUrl: string
  private token: string

  constructor() {
    this.baseUrl = config.remnawave.url
    this.token = config.remnawave.token
  }

  private async getConfig() {
    // Try DB settings first (from setup wizard)
    if (!this.token) {
      const dbUrl = await prisma.setting.findUnique({ where: { key: 'remnawave_url' } })
      const dbToken = await prisma.setting.findUnique({ where: { key: 'remnawave_token' } })
      if (dbUrl) this.baseUrl = dbUrl.value
      if (dbToken) this.token = dbToken.value
    }
    return {
      baseURL: `${this.baseUrl}/api`,
      headers: { Authorization: `Bearer ${this.token}` },
      timeout: 15000,
    }
  }

  get configured() { return !!(this.token || config.remnawave.configured) }

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

  getSubscriptionUrl(uuid: string, customUrl?: string) {
    if (customUrl) return `${this.baseUrl}${customUrl}`
    return `${this.baseUrl}/sub/${uuid}`
  }

  // ── Health / Stats ──────────────────────────────────────────
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
