import { db } from '../../utils/db'

export default defineEventHandler(async (event) => {
  try {
    const idStr = getRouterParam(event, 'id')
    if (!idStr) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Schedule ID is required'
      })
    }

    const id = Number(idStr)
    if (isNaN(id)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid Schedule ID format'
      })
    }

    const success = await db.deleteSchedule(id)
    if (!success) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Schedule not found'
      })
    }

    return {
      success: true,
      message: 'Schedule deleted successfully'
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || `Failed to delete schedule: ${error.message}`
    })
  }
})
