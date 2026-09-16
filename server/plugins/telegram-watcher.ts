import { db } from '../utils/db'
import { decryptToken } from '../utils/crypto'
import { getTelegramUpdates, getTelegramWebhookInfo } from '../utils/telegram'
import { handleTelegramUpdate } from '../utils/moderation'

/**
 * Real-time background Telegram Watcher (Long-polling).
 * Ingests incoming Telegram messages in real-time, powers instant live chat,
 * and triggers immediate AI auto-reply and moderation.
 */
export default defineNitroPlugin((nitroApp) => {
  // STRICTLY only run in local development mode (nuxt dev).
  // Cloudflare Workers prohibits setTimeout in global scope (code 10021)
  // and relies on webhooks (/api/telegram/webhook) for updates.
  if (!import.meta.dev) {
    return
  }

  console.log('[Telegram Watcher] Real-time updates watcher initialized!')

  let offset = 0
  let stopped = false
  let isPolling = false
  let webhookActive = false
  let consecutiveErrors = 0

  const schedule = (ms: number) => {
    if (!stopped) {
      setTimeout(poll, ms)
    }
  }

  const poll = async () => {
    if (stopped || isPolling) return
    isPolling = true

    try {
      const bot = await db.getBot()
      if (!bot || !bot.active) {
        isPolling = false
        return schedule(4000)
      }

      let token = ''
      try {
        token = await decryptToken(bot.token)
      } catch (err: any) {
        console.warn('[Telegram Watcher] Token decryption failed:', err.message)
        isPolling = false
        return schedule(6000)
      }

      const botUserId = Number.parseInt((token ?? '').split(':')[0] ?? '0', 10)

      // Periodically check if a webhook is active
      try {
        const webhookInfo = await getTelegramWebhookInfo(token)
        if (webhookInfo.url) {
          if (!webhookActive) {
            console.log(`[Telegram Watcher] Webhook is active (${webhookInfo.url}). Yielding to webhook.`)
            webhookActive = true
          }
          isPolling = false
          return schedule(10000) // Check again in 10s
        } else {
          webhookActive = false
        }
      } catch {
        // Ignore transient webhook info check errors
      }

      // Long poll Telegram updates with a 15-second server-side window
      const updates = await getTelegramUpdates(token, offset, 15)
      consecutiveErrors = 0

      if (updates && updates.length > 0) {
        for (const update of updates) {
          offset = update.update_id + 1
          try {
            await handleTelegramUpdate(token, botUserId, update)
          } catch (updateErr: any) {
            console.error('[Telegram Watcher] Error processing update:', updateErr.message)
          }
        }
        // Immediate next poll if we received updates
        isPolling = false
        return schedule(0)
      }

      isPolling = false
      return schedule(100)
    } catch (err: any) {
      consecutiveErrors++
      const msg = err.message || ''
      if (/conflict/i.test(msg)) {
        // 409 Conflict: Webhook is set or another getUpdates process is running
        schedule(8000)
      } else {
        const delay = Math.min(consecutiveErrors * 2000, 10000)
        schedule(delay)
      }
    } finally {
      isPolling = false
    }
  }

  // Start polling 1 second after server boot
  schedule(1000)

  nitroApp.hooks.hook('close', () => {
    stopped = true
  })
})