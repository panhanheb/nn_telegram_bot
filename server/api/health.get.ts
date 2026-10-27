import { db } from '../utils/db'
import { getStorageRepository } from '../db'
import { realtimeHub } from '../utils/realtime'

export default defineEventHandler(async () => {
  const startedAt = Date.now()
  let botActive = false
  let botUsername: string | null = null
  let storageStatus = 'ok'
  let targetEngine = 'sqlite'

  try {
    const repo = getStorageRepository()
    targetEngine = repo.constructor.name.includes('D1') ? 'cloudflare-d1' : 'sqlite-wal'
    const bot = await db.getBot()
    if (bot) {
      botActive = bot.active
      botUsername = bot.username
    }
  } catch (err: any) {
    storageStatus = `error: ${err.message}`
  }

  return {
    status: storageStatus === 'ok' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    telegramBotApiVersion: '10.3',
    environment: process.env.NODE_ENV || 'production',
    uptimeSeconds: typeof process.uptime === 'function' ? Math.floor(process.uptime()) : undefined,
    responseTimeMs: Date.now() - startedAt,
    services: {
      storage: {
        status: storageStatus,
        engine: targetEngine
      },
      bot: {
        configured: !!botUsername,
        active: botActive,
        username: botUsername ? `@${botUsername}` : null
      },
      realtime: {
        status: 'active',
        activeHub: 'in-memory-pubsub-sse'
      }
    }
  }
})
