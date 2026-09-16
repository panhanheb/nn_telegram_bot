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

    const body = await readBody(event)
    if (!body) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Request body is required'
      })
    }

    const schedule = await db.getScheduleById(id)
    if (!schedule) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Schedule not found'
      })
    }

    const updates: any = {}

    // Apply updates if defined
    if (body.title !== undefined) updates.title = body.title.trim()
    if (body.message !== undefined) updates.message = body.message.trim()
    if (body.messageType !== undefined) updates.messageType = body.messageType
    if (body.mediaUrl !== undefined) updates.mediaUrl = body.mediaUrl.trim()
    if (body.parseMode !== undefined) updates.parseMode = body.parseMode
    if (body.isActive !== undefined) updates.active = !!body.isActive

    // Target groups (empty array = broadcast to all active groups)
    if (body.targetGroupIds !== undefined) {
      if (Array.isArray(body.targetGroupIds) && body.targetGroupIds.length > 0) {
        const groups = await db.getGroups()
        const validIds = new Set(groups.map(g => g.id))
        const cleaned = body.targetGroupIds
          .map((v: any) => Number(v))
          .filter((n: number) => !isNaN(n) && validIds.has(n))
        if (cleaned.length === 0) {
          throw createError({
            statusCode: 400,
            statusMessage: 'None of the selected target groups exist'
          })
        }
        updates.targetGroupIds = cleaned
      } else {
        updates.targetGroupIds = []
      }
    }

    // Timezone
    if (body.timezone !== undefined) {
      const timezone = body.timezone
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone })
        updates.timezone = timezone
      } catch {
        throw createError({
          statusCode: 400,
          statusMessage: `Invalid timezone specified: ${timezone}`
        })
      }
    }

    // Type and Time validation
    const type = body.type !== undefined ? body.type : schedule.type
    const time = body.time !== undefined ? body.time.trim() : schedule.time

    if (body.type !== undefined || body.time !== undefined) {
      if (type === 'cron') {
        const parts = time.split(/\s+/)
        if (parts.length !== 5) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Invalid Cron expression format. Must contain exactly 5 fields, e.g. "0 9 * * 1-5"'
          })
        }
      } else {
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
        if (!timeRegex.test(time)) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Invalid time format. Time must be in HH:MM (24-hour) format'
          })
        }
      }
      updates.type = type
      updates.time = time
    }

    // Weekday/Monthday parameters
    if (type === 'weekly') {
      if (body.dayOfWeek !== undefined && body.dayOfWeek !== null) {
        const dayOfWeek = parseInt(body.dayOfWeek, 10)
        if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Day of week must be an integer between 0 and 6'
          })
        }
        updates.dayOfWeek = dayOfWeek
      }
    } else {
      // Clear if type changed
      updates.dayOfWeek = null
    }

    if (type === 'monthly') {
      if (body.dayOfMonth !== undefined && body.dayOfMonth !== null) {
        const dayOfMonth = parseInt(body.dayOfMonth, 10)
        if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Day of month must be an integer between 1 and 31'
          })
        }
        updates.dayOfMonth = dayOfMonth
      }
    } else {
      // Clear if type changed
      updates.dayOfMonth = null
    }

    const updated = await db.updateSchedule(id, updates)

    return {
      success: true,
      schedule: {
        id: String(updated.id),
        title: updated.title,
        type: updated.type,
        time: updated.time,
        dayOfWeek: updated.dayOfWeek,
        dayOfMonth: updated.dayOfMonth,
        timezone: updated.timezone,
        message: updated.message,
        messageType: updated.messageType,
        mediaUrl: updated.mediaUrl,
        parseMode: updated.parseMode,
        targetGroupIds: updated.targetGroupIds || [],
        isActive: updated.active,
        createdAt: updated.createdAt
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || `Failed to update schedule: ${error.message}`
    })
  }
})
