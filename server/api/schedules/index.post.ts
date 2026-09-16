import { db } from '../../utils/db'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    if (!body || !body.title || !body.message || !body.time) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Title, Message, and Time are required'
      })
    }

    const title = body.title.trim()
    const message = body.message.trim()
    const time = body.time.trim()
    const type = body.type || 'daily'
    const timezone = body.timezone || 'Asia/Phnom_Penh'
    const messageType = body.messageType || 'text'
    const mediaUrl = body.mediaUrl ? body.mediaUrl.trim() : ''
    const parseMode = body.parseMode || 'HTML'
    const isActive = body.isActive !== undefined ? !!body.isActive : true

    // 1. A bot must be configured to schedule broadcasts
    const bot = await db.getBot()
    if (!bot) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No Telegram bot is configured. Add a bot in Bot Settings before scheduling.'
      })
    }

    // 2. Validate Timezone
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    } catch {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid timezone specified: ${timezone}`
      })
    }

    // 3. Validate Time format based on scheduler type
    if (type === 'cron') {
      const parts = time.split(/\s+/)
      if (parts.length !== 5) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid Cron expression format. Must contain exactly 5 space-separated fields, e.g., "*/5 * * * *"'
        })
      }
    } else {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
      if (!timeRegex.test(time)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid time format. Time must be in HH:MM (24-hour) format, e.g. "08:30"'
        })
      }
    }

    // 4. Validate weekday / monthday parameters
    let dayOfWeek: number | undefined = undefined
    let dayOfMonth: number | undefined = undefined

    if (type === 'weekly') {
      if (body.dayOfWeek === undefined || body.dayOfWeek === null) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Day of week is required for weekly schedules'
        })
      }
      dayOfWeek = parseInt(body.dayOfWeek, 10)
      if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Day of week must be an integer between 0 (Sunday) and 6 (Saturday)'
        })
      }
    }

    if (type === 'monthly') {
      if (body.dayOfMonth === undefined || body.dayOfMonth === null) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Day of month is required for monthly schedules'
        })
      }
      dayOfMonth = parseInt(body.dayOfMonth, 10)
      if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Day of month must be an integer between 1 and 31'
        })
      }
    }

    // 5. Resolve optional target groups (empty = broadcast to all active groups)
    let targetGroupIds: number[] | undefined = undefined
    if (Array.isArray(body.targetGroupIds) && body.targetGroupIds.length > 0) {
      const groups = await db.getGroups()
      const validIds = new Set(groups.map(g => g.id))
      targetGroupIds = body.targetGroupIds
        .map((v: any) => Number(v))
        .filter((n: number) => !isNaN(n) && validIds.has(n))

      if (targetGroupIds!.length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'None of the selected target groups exist'
        })
      }
    }

    // 6. Create schedule record
    const schedule = await db.createSchedule(
      title,
      message,
      time,
      type,
      timezone,
      messageType,
      mediaUrl,
      parseMode,
      { dayOfWeek, dayOfMonth, targetGroupIds },
      isActive
    )

    return {
      success: true,
      schedule: {
        id: String(schedule.id),
        title: schedule.title,
        type: schedule.type,
        time: schedule.time,
        dayOfWeek: schedule.dayOfWeek,
        dayOfMonth: schedule.dayOfMonth,
        timezone: schedule.timezone,
        message: schedule.message,
        messageType: schedule.messageType,
        mediaUrl: schedule.mediaUrl,
        parseMode: schedule.parseMode,
        targetGroupIds: schedule.targetGroupIds || [],
        isActive: schedule.active,
        createdAt: schedule.createdAt
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || `Failed to create schedule: ${error.message}`
    })
  }
})
