import { db } from '../../utils/db'

export default defineEventHandler(async () => {
  try {
    const success = await db.deleteBot()
    if (!success) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No bot is configured'
      })
    }

    return {
      success: true,
      message: 'Bot deleted successfully'
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || `Failed to delete bot: ${error.message}`
    })
  }
})
