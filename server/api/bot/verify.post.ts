import { db } from '../../utils/db'
import { decryptToken } from '../../utils/crypto'
import { verifyTelegramBot } from '../../utils/telegram'

export default defineEventHandler(async () => {
  try {
    const bot = await db.getBot()
    if (!bot) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No bot is configured'
      })
    }

    let botInfo
    try {
      const token = await decryptToken(bot.token)
      botInfo = await verifyTelegramBot(token)
    } catch (err: any) {
      const updated = await db.updateBot({ status: 'OFFLINE' })
      return {
        success: false,
        status: 'OFFLINE',
        message: `Verification failed: ${err.message}`,
        bot: {
          id: updated.id,
          username: updated.username,
          firstName: updated.firstName,
          active: updated.active,
          permissions: updated.permissions,
          status: updated.status,
          createdAt: updated.createdAt
        }
      }
    }

    // Refresh credentials on success
    const updated = await db.updateBot({
      username: botInfo.username || bot.username,
      firstName: botInfo.first_name || bot.firstName,
      status: 'ONLINE',
      permissions: {
        can_join_groups: botInfo.can_join_groups,
        can_read_all_group_messages: botInfo.can_read_all_group_messages,
        supports_inline_queries: botInfo.supports_inline_queries
      }
    })

    return {
      success: true,
      status: 'ONLINE',
      bot: {
        id: updated.id,
        username: updated.username,
        firstName: updated.firstName,
        active: updated.active,
        permissions: updated.permissions,
        status: updated.status,
        createdAt: updated.createdAt
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || `Verification process failed: ${error.message}`
    })
  }
})
