import { db } from '../../utils/db'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const updates: Record<string, any> = {}

    if (body.enabled !== undefined) updates.enabled = !!body.enabled
    if (body.deleteLinks !== undefined) updates.deleteLinks = !!body.deleteLinks
    if (body.deleteStickers !== undefined) updates.deleteStickers = !!body.deleteStickers
    if (body.deleteFiles !== undefined) updates.deleteFiles = !!body.deleteFiles
    if (Array.isArray(body.blockedExtensions)) updates.blockedExtensions = body.blockedExtensions

    const settings = await db.saveModerationSettings(updates)

    return {
      success: true,
      settings
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || `Failed to update moderation settings: ${error.message}`
    })
  }
})
