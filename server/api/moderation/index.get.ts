import { db } from '../../utils/db'

export default defineEventHandler(async () => {
  try {
    return await db.getModerationSettings()
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch moderation settings: ${error.message}`
    })
  }
})
