/**
 * HIDEYOU PRO — Telegram Bot standalone runner
 */

import { startBot } from './index'
import { logger }   from '../utils/logger'

logger.info('Starting HIDEYOU PRO Telegram Bot...')
logger.info(`Mode: ${process.env.NODE_ENV || 'production'}`)

startBot().catch(err => {
  logger.error('Bot crashed:', err)
  process.exit(1)
})
