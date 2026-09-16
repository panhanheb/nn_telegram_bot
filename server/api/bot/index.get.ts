import { db } from '../../utils/db'

export default defineEventHandler(async () => {
  try {
    const bot = await db.getBot()
    if (!bot) {
      return null
    }
    return {
      id: bot.id,
      username: bot.username,
      firstName: bot.firstName,
      active: bot.active,
      permissions: bot.permissions,
      status: bot.status,
      createdAt: bot.createdAt
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch bot: ${error.message}`
    })
  }
})
