import { db } from '../../utils/db'
import { decryptToken, timingSafeEqual } from '../../utils/crypto'
import { handleTelegramUpdate } from '../../utils/moderation'
import type { TelegramUpdate } from '../../utils/telegram'

/**
 * Telegram pushes updates here. Powers real-time live chat and moderation
 * on Cloudflare Workers and production serverless deployments.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Authenticate caller: If a webhook secret is configured, require and verify the header
  const configuredSecret = (config.webhookSecret || process.env.TELEGRAM_WEBHOOK_SECRET || '').trim()
  if (configuredSecret) {
    const receivedSecret = getHeader(event, 'x-telegram-bot-api-secret-token') || ''
    if (!receivedSecret || !timingSafeEqual(receivedSecret, configuredSecret)) {
      console.warn('[Webhook] Rejected incoming update: Secret token mismatch or missing')
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: Invalid secret token'
      })
    }
  }

  const update = await readBody<TelegramUpdate>(event).catch(() => null)
  if (!update || typeof update.update_id !== 'number') {
    return { ok: true }
  }

  const bot = await db.getBot()
  if (!bot || !bot.active) return { ok: true }

  let token = ''
  try {
    token = await decryptToken(bot.token)
  } catch {
    return { ok: true }
  }

  const botUserId = parseInt(token.split(':')[0] || '0', 10)

  try {
    await handleTelegramUpdate(token, botUserId, update)
  } catch (err: any) {
    // Always return 200 { ok: true } so Telegram doesn't retry-storm or back off
    console.error('[Webhook] Failed to handle update:', err.message)
  }

  return { ok: true }
})
