/**
 * Bot State — user input waiting state + delayed block scheduling
 */

import Redis from 'ioredis'
import { config } from '../config'
import { logger } from '../utils/logger'

const redis = new Redis(config.redis.url)

const STATE_PREFIX = 'bot:state:'
const DELAY_PREFIX = 'bot:delay:'

export interface UserInputState {
  waitingInput: boolean
  blockId: string
  inputVar: string
  inputValidation: string
  nextBlockId: string | null
}

export async function setUserState(userId: string, state: UserInputState): Promise<void> {
  await redis.set(`${STATE_PREFIX}${userId}`, JSON.stringify(state), 'EX', 3600) // 1h TTL
}

export async function getUserState(userId: string): Promise<UserInputState | null> {
  const raw = await redis.get(`${STATE_PREFIX}${userId}`)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export async function clearUserState(userId: string): Promise<void> {
  await redis.del(`${STATE_PREFIX}${userId}`)
}

export async function scheduleDelayedBlock(userId: string, blockId: string, delayMinutes: number): Promise<void> {
  const executeAt = Date.now() + delayMinutes * 60_000
  await redis.zadd('bot:delayed_blocks', executeAt, JSON.stringify({ userId, blockId }))
  logger.debug(`Scheduled block ${blockId} for user ${userId} in ${delayMinutes}m`)
}

export async function getReadyDelayedBlocks(): Promise<{ userId: string; blockId: string }[]> {
  const now = Date.now()
  const items = await redis.zrangebyscore('bot:delayed_blocks', 0, now)
  if (items.length) {
    await redis.zremrangebyscore('bot:delayed_blocks', 0, now)
  }
  return items.map(raw => {
    try { return JSON.parse(raw) } catch { return null }
  }).filter(Boolean)
}
