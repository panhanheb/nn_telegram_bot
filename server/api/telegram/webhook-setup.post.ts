import { db } from '../../utils/db'
import { decryptToken } from '../../utils/crypto'
import { setTelegramWebhook, getTelegramWebhookInfo } from '../../utils/telegram'

/**
 * Registers this deployment's /api/telegram/webhook URL with Telegram so
 * updates (discovery, chat, moderation, AI) get pushed to us in real time.
 */
export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const bot = await db.getBot()
    if (!bot) {
      throw createError({ statusCode: 404, statusMessage: 'No bot is configured' })
    }

    // Prefer an explicitly configured public URL, else infer from the request
    const body = await readBody(event).catch(() => ({}))
    const base =
      (body?.baseUrl && String(body.baseUrl).trim()) ||
      config.publicUrl ||
      getRequestURL(event).origin

    if (!base || base.startsWith('http://localhost') || base.startsWith('http://127.0.0.1')) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'A public HTTPS URL is required. Telegram cannot reach localhost — deploy first or configure NUXT_PUBLIC_URL.'
      })
    }

    const url = `${base.replace(/\/$/, '')}/api/telegram/webhook`
    const token = await decryptToken(bot.token)
    await setTelegramWebhook(token, url, config.webhookSecret)
    const info = await getTelegramWebhookInfo(token).catch(() => null)

    return {
      success: true,
      url,
      info
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || `Failed to set webhook: ${error.message}`
    })
  }
})
