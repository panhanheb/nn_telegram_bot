import { db } from '../../utils/db'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const updated = await db.saveMenuSettings(body)
    return { ok: true, settings: updated }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to save menu settings: ${error.message}`
    })
  }
})

