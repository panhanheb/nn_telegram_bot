import { db } from '../../utils/db'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const updates: Record<string, any> = {}

    if (body.enabled !== undefined) updates.enabled = !!body.enabled
    if (body.deleteLinks !== undefined) updates.deleteLinks = !!body.deleteLinks
    if (body.deleteStickers !== undefined) updates.deleteStickers = !!body.deleteStickers
    if (body.deleteFiles !== undefined) updates.deleteFiles = !!body.deleteFiles
    if (Array.isArray(body.blockedExtensions)) {
      // Store bare lower-case extensions ("exe", not ".EXE"); '*' blocks every file.
      const cleaned = body.blockedExtensions
        .filter((e: unknown): e is string => typeof e === 'string')
        .map((e: string) => e.trim().toLowerCase().replace(/^\.+/, ''))
        .filter((e: string) => /^(\*|[a-z0-9]{1,16})$/.test(e))
      updates.blockedExtensions = [...new Set<string>(cleaned)].slice(0, 300)
    }
    if (Array.isArray(body.blockedKeywords)) {
      const cleaned = body.blockedKeywords
        .filter((k: unknown): k is string => typeof k === 'string')
        .map((k: string) => k.trim().toLowerCase().replace(/\s+/g, ' '))
        .filter((k: string) => k.length > 0 && k.length <= 64)
      const unique = [...new Set<string>(cleaned)]
      if (unique.length > 100) {
        throw createError({ statusCode: 400, statusMessage: 'At most 100 blocked keywords are allowed' })
      }
      updates.blockedKeywords = unique
    }
    if (body.exemptAdmins !== undefined) updates.exemptAdmins = !!body.exemptAdmins
    if (body.warnLimit !== undefined) {
      const n = Math.floor(Number(body.warnLimit))
      if (!Number.isFinite(n) || n < 0 || n > 20) {
        throw createError({ statusCode: 400, statusMessage: 'warnLimit must be between 0 and 20' })
      }
      updates.warnLimit = n
    }
    if (body.muteMinutes !== undefined) {
      const n = Math.floor(Number(body.muteMinutes))
      if (!Number.isFinite(n) || n < 1 || n > 525600) {
        throw createError({ statusCode: 400, statusMessage: 'muteMinutes must be between 1 and 525600' })
      }
      updates.muteMinutes = n
    }
    if (typeof body.rulesText === 'string') updates.rulesText = body.rulesText.slice(0, 3000)

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
