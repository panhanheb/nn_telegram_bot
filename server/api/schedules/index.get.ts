import { db } from '../../utils/db'
import { findNextOccurrence } from '../../utils/scheduler'

export default defineEventHandler(async (event) => {
  try {
    const schedules = await db.getSchedules()
    const now = new Date()
    
    // Sort schedules by time/cron alphabetically as a fallback sort
    const sorted = [...schedules].sort((a, b) => a.title.localeCompare(b.title))

    return sorted.map(s => ({
      id: String(s.id),
      title: s.title,
      type: s.type || 'daily',
      time: s.time,
      dayOfWeek: s.dayOfWeek,
      dayOfMonth: s.dayOfMonth,
      timezone: s.timezone || 'Asia/Phnom_Penh',
      message: s.message,
      messageType: s.messageType || 'text',
      mediaUrl: s.mediaUrl || '',
      parseMode: s.parseMode || 'HTML',
      targetGroupIds: s.targetGroupIds || [],
      isActive: s.active,
      createdAt: s.createdAt || new Date().toISOString(),
      lastExecutedAt: s.lastExecutedAt,
      lastDelivery: s.lastDelivery || null,
      nextRunAt: findNextOccurrence(s, now)?.toISOString() || null
    }))
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch schedules: ${error.message}`
    })
  }
})
