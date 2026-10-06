import { db } from '../../utils/db'
import { decryptToken } from '../../utils/crypto'
import { getMyCommands, getChatMenuButton } from '../../utils/telegram'

export default defineEventHandler(async () => {
  try {
    const settings = await db.getMenuSettings()
    const bot = await db.getBot()
    const config = useRuntimeConfig()

    let token = ''
    if (bot?.token) {
      try {
        token = await decryptToken(bot.token)
      } catch {
        token = bot.token
      }
    }
    if (!token) {
      token = (config.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '').trim()
    }

    let liveCommands: any[] = []
    let liveMenuButton: any = null
    if (token) {
      try {
        liveCommands = await getMyCommands(token)
        liveMenuButton = await getChatMenuButton(token)
      } catch (err: any) {
        console.warn('[menu.get] Failed to fetch live telegram menu info:', err.message)
      }
    }

    return {
      settings,
      liveCommands,
      liveMenuButton
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch menu settings: ${error.message}`
    })
  }
})

