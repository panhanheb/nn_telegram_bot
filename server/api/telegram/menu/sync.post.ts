import { db } from '../../../utils/db'
import { decryptToken } from '../../../utils/crypto'
import { syncBotMenuToTelegram } from '../../../utils/bot-menu'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const bot = await db.getBot()

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

    if (!token) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No Telegram bot token configured. Please connect a bot first.'
      })
    }

    const settings = await db.getMenuSettings()
    const publicUrl = (config.public?.appUrl || process.env.NUXT_PUBLIC_URL || '').trim()

    const result = await syncBotMenuToTelegram(token, settings, publicUrl)
    return { ok: true, ...result }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to sync menu to Telegram: ${error.message}`
    })
  }
})

