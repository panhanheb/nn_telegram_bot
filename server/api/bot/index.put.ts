import { db } from '../../utils/db'

export default defineEventHandler(async (event) => {
  try {
    const bot = await db.getBot()
    if (!bot) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No bot is configured'
      })
    }

    const body = await readBody(event)
    const updates: any = {}

    if (body.active !== undefined) {
      updates.active = !!body.active
    }

    if (body.status !== undefined) {
      updates.status = body.status
    }

    const updated = await db.updateBot(updates)

    return {
      success: true,
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
      statusMessage: error.statusMessage || `Failed to update bot: ${error.message}`
    })
  }
})
