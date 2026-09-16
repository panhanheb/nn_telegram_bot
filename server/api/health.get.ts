import { db } from '../utils/db'

export default defineEventHandler(async () => {
  const startedAt = Date.now()
  let botActive = false
  let botUsername: string | null = null
  let storageStatus = 'ok'

  try {
    const bot = await db.getBot()
    if (bot) {
      botActive = bot.active
      botUsername = bot.username
    }
  } catch (err: any) {
    storageStatus = `error: ${err.message}`
  }

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'production',
    uptime: typeof process.uptime === 'function' ? Math.floor(process.uptime()) : undefined,
    responseTimeMs: Date.now() - startedAt,
    services: {
      storage: storageStatus,
      bot: {
        configured: !!botUsername,
        active: botActive,
        username: botUsername ? `@${botUsername}` : null
      }
    }
  }
})
