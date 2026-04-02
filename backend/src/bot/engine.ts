/**
 * Bot Engine — No-Code block executor
 *
 * Replaces hardcoded bot handlers with a DB-driven block system.
 * Blocks are cached in memory for zero-latency lookups.
 */

import { InlineKeyboard, Context } from 'grammy'
import Redis              from 'ioredis'
import { prisma }         from '../db'
import { logger }         from '../utils/logger'
import { config }         from '../config'
import { remnawave }      from '../services/remnawave'
import { balanceService } from '../services/balance'
import type { BotBlock, BotButton, BotTrigger } from '@prisma/client'

const redis = new Redis(config.redis.url)

// ── Types ─────────────────────────────────────────────────────
type BlockWithButtons = BotBlock & { buttons: BotButton[] }

interface BlockCache {
  blocks: Map<string, BlockWithButtons>
  triggers: BotTrigger[]
  loadedAt: number
}

// ── Cache ─────────────────────────────────────────────────────
let cache: BlockCache = { blocks: new Map(), triggers: [], loadedAt: 0 }
const CACHE_TTL = 60_000 // 1 min

export async function loadBlockCache(): Promise<void> {
  const blocks = await prisma.botBlock.findMany({
    where: { isDraft: false },
    include: { buttons: { orderBy: [{ row: 'asc' }, { col: 'asc' }] } },
  })
  const triggers = await prisma.botTrigger.findMany({
    orderBy: { priority: 'desc' },
  })

  const map = new Map<string, BlockWithButtons>()
  for (const b of blocks) map.set(b.id, b)

  cache = { blocks: map, triggers, loadedAt: Date.now() }
  logger.info(`Bot engine: loaded ${blocks.length} blocks, ${triggers.length} triggers`)
}

export function invalidateBlockCache(): void {
  cache.loadedAt = 0
}

async function ensureCache(): Promise<BlockCache> {
  if (Date.now() - cache.loadedAt > CACHE_TTL) await loadBlockCache()
  return cache
}

function getBlock(id: string): BlockWithButtons | undefined {
  return cache.blocks.get(id)
}

// ── Variable substitution ─────────────────────────────────────
async function resolveVariables(text: string, userId: string): Promise<string> {
  if (!text.includes('{')) return text

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return text

  let rmUser: any = null
  if (user.remnawaveUuid) {
    try { rmUser = await remnawave.getUserByUuid(user.remnawaveUuid) } catch {}
  }

  const expireAt = rmUser?.expireAt ? new Date(rmUser.expireAt) : (user.subExpireAt ? new Date(user.subExpireAt) : null)
  const daysLeft = expireAt ? Math.max(0, Math.ceil((expireAt.getTime() - Date.now()) / 86400_000)) : 0
  const usedBytes = rmUser?.userTraffic?.usedTrafficBytes ?? 0
  const limitBytes = rmUser?.trafficLimitBytes ?? 0

  // User variables from DB
  const userVars = await prisma.userVariable.findMany({ where: { userId } })
  const varMap = new Map(userVars.map(v => [v.key, v.value]))

  const vars: Record<string, string> = {
    name: user.telegramName || user.email?.split('@')[0] || 'Пользователь',
    email: user.email || '—',
    telegramName: user.telegramName || '—',
    telegramId: user.telegramId || '—',
    userId: user.id,
    balance: String(user.balance),
    bonusDays: String(user.bonusDays),
    subStatus: user.subStatus,
    subExpireDate: expireAt ? formatDateRu(expireAt) : '—',
    daysLeft: String(daysLeft),
    trafficUsed: (usedBytes / 1e9).toFixed(1) + ' ГБ',
    trafficLimit: limitBytes > 0 ? (limitBytes / 1e9).toFixed(0) + ' ГБ' : 'Безлимит',
    deviceCount: '—',
    deviceLimit: String(rmUser?.hwidDeviceLimit ?? 0),
    referralCode: user.referralCode,
    referralUrl: `https://t.me/${config.telegram.botName}?start=ref_${user.referralCode}`,
    referralCount: '0',
    referralPaidCount: '0',
    appUrl: config.appUrl,
  }

  // Referral counts
  try {
    const [total, paid] = await Promise.all([
      prisma.user.count({ where: { referredById: userId } }),
      prisma.referralBonus.count({ where: { referrerId: userId, bonusType: 'DAYS' } }),
    ])
    vars.referralCount = String(total)
    vars.referralPaidCount = String(paid)
  } catch {}

  // Device count
  if (user.remnawaveUuid) {
    try {
      const devData = await remnawave.getDevices(user.remnawaveUuid)
      vars.deviceCount = String(devData.devices?.length ?? 0)
    } catch {}
  }

  // Merge user custom variables
  for (const [k, v] of varMap) vars[`user:${k}`] = v

  let result = text
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val)
  }
  return result
}

// ── Keyboard builder ──────────────────────────────────────────
function buildInlineKeyboard(buttons: BotButton[]): InlineKeyboard | undefined {
  if (!buttons.length) return undefined

  const kb = new InlineKeyboard()
  let currentRow = -1

  for (const btn of buttons) {
    if (btn.row > currentRow && currentRow >= 0) kb.row()
    currentRow = btn.row

    if (btn.type === 'block' && btn.nextBlockId) {
      kb.text(btn.label, `blk:${btn.nextBlockId}`)
    } else if (btn.type === 'url' && btn.url) {
      kb.url(btn.label, btn.url)
    } else if (btn.type === 'webapp' && btn.url) {
      const url = btn.url.startsWith('/') ? `${config.appUrl}${btn.url}` : btn.url
      kb.webApp(btn.label, url)
    } else if (btn.type === 'contact') {
      // Grammy doesn't have requestContact on inline — use callback
      kb.text(btn.label, `blk:${btn.nextBlockId || ''}`)
    }
  }

  return kb
}

// ── Condition checker ─────────────────────────────────────────
async function checkCondition(conditionType: string, conditionValue: string | null, userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return false

  switch (conditionType) {
    case 'has_sub':
      return user.subStatus === 'ACTIVE' && !!user.remnawaveUuid
    case 'no_sub':
      return user.subStatus !== 'ACTIVE' || !user.remnawaveUuid
    case 'has_remnawave':
      return !!user.remnawaveUuid
    case 'expired':
      return user.subStatus === 'EXPIRED'
    case 'traffic_80': {
      if (!user.remnawaveUuid) return false
      try {
        const rm = await remnawave.getUserByUuid(user.remnawaveUuid)
        const used = rm.userTraffic?.usedTrafficBytes ?? 0
        const limit = rm.trafficLimitBytes ?? 0
        return limit > 0 && used / limit >= 0.8
      } catch { return false }
    }
    case 'has_tag':
      if (!conditionValue) return false
      return !!(await prisma.userTag.findUnique({ where: { userId_tag: { userId, tag: conditionValue } } }))
    case 'no_tag':
      if (!conditionValue) return false
      return !(await prisma.userTag.findUnique({ where: { userId_tag: { userId, tag: conditionValue } } }))
    case 'has_var':
      if (!conditionValue) return false
      return !!(await prisma.userVariable.findUnique({ where: { userId_key: { userId, key: conditionValue } } }))
    case 'has_email':
      return !!user.email
    case 'has_referrer':
      return !!user.referredById
    default:
      return false
  }
}

// ── Action performer ──────────────────────────────────────────
async function performAction(actionType: string, actionValue: string | null, userId: string): Promise<void> {
  const val = parseInt(actionValue || '0', 10) || 0

  switch (actionType) {
    case 'bonus_days':
      await prisma.user.update({ where: { id: userId }, data: { bonusDays: { increment: val } } })
      break
    case 'balance':
      await balanceService.credit({ userId, amount: val, type: 'TOPUP', description: 'Бонус' })
      break
    case 'trial': {
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (user && !user.remnawaveUuid) {
        // Use existing createTrialSubscription logic
        const { createTrialForUser } = await import('./trial')
        await createTrialForUser(userId)
      }
      break
    }
    case 'add_tag': {
      if (!actionValue) break
      await prisma.userTag.upsert({
        where: { userId_tag: { userId, tag: actionValue } },
        create: { userId, tag: actionValue },
        update: {},
      })
      break
    }
    case 'remove_tag': {
      if (!actionValue) break
      await prisma.userTag.deleteMany({ where: { userId, tag: actionValue } })
      break
    }
    case 'set_var': {
      if (!actionValue) break
      const [key, ...rest] = actionValue.split('=')
      const value = rest.join('=')
      if (key && value) {
        await prisma.userVariable.upsert({
          where: { userId_key: { userId, key } },
          create: { userId, key, value },
          update: { value },
        })
      }
      break
    }
  }
}

// ── Throttle check ────────────────────────────────────────────
async function isThrottled(blockId: string, userId: string, minutes: number): Promise<boolean> {
  if (minutes <= 0) return false
  const key = `throttle:${blockId}:${userId}`
  try {
    const exists = await redis.get(key)
    if (exists) return true
    // Set throttle key with TTL
    await redis.set(key, '1', 'EX', minutes * 60)
    return false
  } catch {
    // Redis unavailable — don't throttle
    return false
  }
}

// ── Stats tracking ────────────────────────────────────────────
async function trackView(blockId: string): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  try {
    await prisma.botBlockStat.upsert({
      where: { blockId_date: { blockId, date: today } },
      create: { blockId, date: today, views: 1 },
      update: { views: { increment: 1 } },
    })
  } catch {}
}

async function trackClick(buttonId: string): Promise<void> {
  try {
    await prisma.botButton.update({
      where: { id: buttonId },
      data: { clickCount: { increment: 1 } },
    })
  } catch {}
}

// ── Schedule check ────────────────────────────────────────────
function isInSchedule(block: BlockWithButtons): boolean {
  if (!block.scheduleStart && !block.scheduleEnd) return true

  const now = new Date()
  const tzOffsetHours = parseInt(process.env.TZ_OFFSET_HOURS || '3', 10) // default UTC+3 (Moscow)
  const moscowOffset = tzOffsetHours * 60
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const moscowMinutes = (utcMinutes + moscowOffset) % 1440

  if (block.scheduleStart) {
    const [h, m] = block.scheduleStart.split(':').map(Number)
    if (moscowMinutes < h * 60 + m) return false
  }
  if (block.scheduleEnd) {
    const [h, m] = block.scheduleEnd.split(':').map(Number)
    if (moscowMinutes > h * 60 + m) return false
  }

  if (block.scheduleDays) {
    const days = block.scheduleDays as number[]
    const moscowDay = ((now.getUTCDay() + (utcMinutes + moscowOffset >= 1440 ? 1 : 0)) % 7) || 7 // 1=Mon
    if (!days.includes(moscowDay)) return false
  }

  return true
}

// ══════════════════════════════════════════════════════════════
//  MAIN EXECUTOR
// ══════════════════════════════════════════════════════════════

export async function executeBlock(
  blockId: string,
  ctx: Context,
  userId: string,
  depth = 0,
): Promise<void> {
  if (depth > 10) {
    logger.warn(`Bot engine: max depth reached for block ${blockId}`)
    return
  }

  await ensureCache()
  const block = getBlock(blockId)
  if (!block) {
    logger.warn(`Bot engine: block ${blockId} not found`)
    return
  }

  // Schedule check
  if (!isInSchedule(block)) {
    if (block.scheduleBlockId) {
      return executeBlock(block.scheduleBlockId, ctx, userId, depth + 1)
    }
    return
  }

  // Track stats
  trackView(block.id).catch(() => {})

  // Delete previous message if configured
  if (block.deletePrev === 'full') {
    try { await ctx.deleteMessage() } catch {}
  } else if (block.deletePrev === 'buttons') {
    try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }) } catch {}
  }

  switch (block.type) {
    case 'MESSAGE':
      await executeMessage(block, ctx, userId)
      break

    case 'CONDITION':
      await executeCondition(block, ctx, userId, depth)
      break

    case 'ACTION':
      await executeAction(block, ctx, userId, depth)
      break

    case 'INPUT':
      await executeInput(block, ctx, userId)
      break

    case 'DELAY':
      await executeDelay(block, ctx, userId)
      break

    case 'SPLIT':
      await executeSplit(block, ctx, userId, depth)
      break

    case 'REDIRECT':
      if (block.redirectBlockId) {
        await executeBlock(block.redirectBlockId, ctx, userId, depth + 1)
      }
      break

    case 'NOTIFY_ADMIN':
      await executeNotifyAdmin(block, userId)
      if (block.nextBlockId) await executeBlock(block.nextBlockId, ctx, userId, depth + 1)
      break

    case 'HTTP':
      await executeHttp(block, userId)
      if (block.nextBlockId) await executeBlock(block.nextBlockId, ctx, userId, depth + 1)
      break

    case 'REACTION':
      await executeReaction(block, ctx)
      if (block.nextBlockId) await executeBlock(block.nextBlockId, ctx, userId, depth + 1)
      break
  }
}

// ── Block type executors ──────────────────────────────────────

async function executeMessage(block: BlockWithButtons, ctx: Context, userId: string): Promise<void> {
  const text = await resolveVariables(block.text || '', userId)
  const kb = buildInlineKeyboard(block.buttons)

  const opts: any = {
    parse_mode: block.parseMode || 'Markdown',
    reply_markup: kb,
  }

  // Try edit first (for callback queries), fallback to reply
  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, opts)
    } else {
      await ctx.reply(text, opts)
    }
  } catch {
    try { await ctx.reply(text, opts) } catch (e) {
      logger.warn(`Bot engine: failed to send message for block ${block.id}:`, e)
    }
  }

  // Pin if needed
  if (block.pinMessage) {
    try {
      const msg = ctx.message || ctx.callbackQuery?.message
      if (msg) await ctx.api.pinChatMessage(msg.chat.id, msg.message_id)
    } catch {}
  }
}

async function executeCondition(block: BlockWithButtons, ctx: Context, userId: string, depth: number): Promise<void> {
  const result = await checkCondition(block.conditionType || '', block.conditionValue, userId)
  const nextId = result ? block.nextBlockTrue : block.nextBlockFalse
  if (nextId) await executeBlock(nextId, ctx, userId, depth + 1)
}

async function executeAction(block: BlockWithButtons, ctx: Context, userId: string, depth: number): Promise<void> {
  if (block.actionType) {
    await performAction(block.actionType, block.actionValue, userId)
  }
  if (block.nextBlockId) await executeBlock(block.nextBlockId, ctx, userId, depth + 1)
}

async function executeInput(block: BlockWithButtons, ctx: Context, userId: string): Promise<void> {
  const text = await resolveVariables(block.inputPrompt || 'Введите значение:', userId)
  const kb = block.buttons.length ? buildInlineKeyboard(block.buttons) : undefined

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: kb })
    } else {
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb })
    }
  } catch {
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: kb }).catch(() => {})
  }

  // Store state: waiting for input
  const { setUserState } = await import('./state')
  await setUserState(userId, {
    waitingInput: true,
    blockId: block.id,
    inputVar: block.inputVar || 'input',
    inputValidation: block.inputValidation || 'text',
    nextBlockId: block.nextBlockId,
  })
}

async function executeDelay(block: BlockWithButtons, ctx: Context, userId: string): Promise<void> {
  // For bot context, delays are handled by scheduler
  // Here we just schedule the next block
  if (block.nextBlockId && block.delayMinutes) {
    const { scheduleDelayedBlock } = await import('./state')
    await scheduleDelayedBlock(userId, block.nextBlockId, block.delayMinutes)
  }
}

async function executeSplit(block: BlockWithButtons, ctx: Context, userId: string, depth: number): Promise<void> {
  const variants = block.splitVariants as { blockId: string; weight: number }[] | null
  if (!variants?.length) return

  const totalWeight = variants.reduce((s, v) => s + v.weight, 0)
  let rand = Math.random() * totalWeight
  for (const v of variants) {
    rand -= v.weight
    if (rand <= 0) {
      await executeBlock(v.blockId, ctx, userId, depth + 1)
      return
    }
  }
  await executeBlock(variants[0].blockId, ctx, userId, depth + 1)
}

async function executeNotifyAdmin(block: BlockWithButtons, userId: string): Promise<void> {
  if (!block.notifyAdminText) return
  const text = await resolveVariables(block.notifyAdminText, userId)

  // Send to all admins
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', telegramId: { not: null } },
    select: { telegramId: true },
  })

  const { bot } = await import('./index')
  for (const admin of admins) {
    if (admin.telegramId) {
      try { await bot.api.sendMessage(admin.telegramId, `🔔 ${text}`) } catch {}
    }
  }
}

async function executeHttp(block: BlockWithButtons, userId: string): Promise<void> {
  if (!block.httpUrl) return

  try {
    const url = await resolveVariables(block.httpUrl, userId)
    const body = block.httpBody ? await resolveVariables(block.httpBody, userId) : undefined

    const resp = await fetch(url, {
      method: block.httpMethod || 'GET',
      headers: { 'Content-Type': 'application/json', ...(block.httpHeaders as any || {}) },
      body: block.httpMethod === 'POST' ? body : undefined,
    })

    if (block.httpSaveVar) {
      const responseText = await resp.text()
      await prisma.userVariable.upsert({
        where: { userId_key: { userId, key: block.httpSaveVar } },
        create: { userId, key: block.httpSaveVar, value: responseText.slice(0, 1000) },
        update: { value: responseText.slice(0, 1000) },
      })
    }
  } catch (e) {
    logger.warn(`Bot engine: HTTP block ${block.id} failed:`, e)
  }
}

async function executeReaction(block: BlockWithButtons, ctx: Context): Promise<void> {
  if (!block.reactionEmoji) return
  try {
    const msg = ctx.message || ctx.callbackQuery?.message
    if (msg) {
      await ctx.api.setMessageReaction(msg.chat.id, msg.message_id, [
        { type: 'emoji', emoji: block.reactionEmoji as any },
      ])
    }
  } catch {}
}

// ── Trigger resolver ──────────────────────────────────────────
export async function findTriggerBlock(type: string, value: string): Promise<string | null> {
  await ensureCache()
  const trigger = cache.triggers.find(t => t.type === type && t.value === value)
  return trigger?.blockId ?? null
}

// ── Helpers ───────────────────────────────────────────────────
const RUSSIAN_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

function formatDateRu(d: Date): string {
  return `${d.getDate()} ${RUSSIAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
