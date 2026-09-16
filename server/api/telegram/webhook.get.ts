import { db } from '../../utils/db'
import { decryptToken } from '../../utils/crypto'
import { getTelegramWebhookInfo } from '../../utils/telegram'

export default defineEventHandler(async () => {
  try {
    const bot = await db.getBot()
    if (!bot) {
      return { configured: false, url: '', pendingUpdateCount: 0, lastError: null }
    }

    const token = await decryptToken(bot.token)
    const info = await getTelegramWebhookInfo(token)

    return {
      configured: !!info.url,
      url: info.url,
      pendingUpdateCount: info.pending_update_count,
      lastError: info.last_error_message || null
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to read webhook info: ${error.message}`
    })
  }
})
