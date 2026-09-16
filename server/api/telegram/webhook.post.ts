import { db } from '../../utils/db'
import { decryptToken } from '../../utils/crypto'
import { handleTelegramUpdate } from '../../utils/moderation'
import type { TelegramUpdate } from '../../utils/telegram'

/**
 * Telegram pushes updates here. Powers real-time live chat and moderation
 * on Cloudflare Workers and production serverless deployments.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Authenticate the caller if a secret token was configured and sent
  const secret = getHeader(event, 'x-telegram-bot-api-secret-token')
  if (secret && config.webhookSecret && secret !== config.webhookSecret) {
    console.warn('[Webhook] Rejected update: Secret token mismatch')
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
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

  const botUserId = parseInt(token.split(':')[0], 10)

  try {
    await handleTelegramUpdate(token, botUserId, update)
  } catch (err: any) {
    // Always return 200 { ok: true } so Telegram doesn't retry-storm or back off
    console.error('[Webhook] Failed to handle update:', err.message)
  }

  return { ok: true }
})
