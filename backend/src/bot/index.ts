// Bot module placeholder — will be fully ported from HideYou
import { logger } from '../utils/logger'

export const bot = {
  api: {
    sendMessage: async (chatId: string, text: string, opts?: any) => {
      logger.warn(`Bot stub: sendMessage to ${chatId}`)
    },
  },
}

export async function startBot() {
  logger.info('Bot placeholder — not yet configured')
}
