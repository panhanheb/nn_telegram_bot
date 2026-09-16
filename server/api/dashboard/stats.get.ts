import { db } from '../../utils/db'

export default defineEventHandler(async () => {
  try {
    const bot = await db.getBot()
    const groups = await db.getGroups()
    const schedules = await db.getSchedules()
    const logs = await db.getLogs()

    const botConfigured = !!bot
    const botOnline = !!bot && bot.active && bot.status === 'ONLINE'

    const totalGroups = groups.filter(g => g.type !== 'channel').length
    const totalChannels = groups.filter(g => g.type === 'channel').length
    const overallGroupsCount = groups.length

    const activeSchedulesCount = schedules.filter(s => s.active).length

    const totalLogs = logs.length
    const messagesSent = logs.filter(l => l.status === 'SUCCESS').length
    const failedDeliveries = logs.filter(l => l.status === 'FAILED').length
    const successRate = totalLogs > 0 ? Math.round((messagesSent / totalLogs) * 100) : 100

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const sentToday = logs.filter(
      l => new Date(l.sentAt) >= startOfDay && l.status === 'SUCCESS'
    ).length

    const failedToday = logs.filter(
      l => new Date(l.sentAt) >= startOfDay && l.status === 'FAILED'
    ).length

    // Calculate next scheduled message
    const upcomingSchedules = schedules.filter(s => s.active && s.type !== 'cron') // standard daily/weekly/monthly HH:MM
    let nextSchedule = null
    if (upcomingSchedules.length > 0) {
      const now = new Date()
      const currentHours = now.getHours()
      const currentMinutes = now.getMinutes()
      const currentMinutesTotal = currentHours * 60 + currentMinutes

      const schedulesWithDiff = upcomingSchedules.map(s => {
        // Parse time HH:MM
        const [hoursStr, minutesStr] = s.time.split(':')
        const hours = parseInt(hoursStr)
        const minutes = parseInt(minutesStr)
        const scheduleMinutes = hours * 60 + minutes

        let diff = scheduleMinutes - currentMinutesTotal
        let runsToday = true
        if (diff <= 0) {
          diff += 1440 // 24 hours in minutes
          runsToday = false
        }

        const execTime = new Date()
        execTime.setHours(hours, minutes, 0, 0)
        if (!runsToday) {
          execTime.setDate(execTime.getDate() + 1)
        }

        return {
          schedule: s,
          diff,
          execTime
        }
      })

      // Sort by difference in minutes ascending
      schedulesWithDiff.sort((a, b) => a.diff - b.diff)
      const next = schedulesWithDiff[0]
      nextSchedule = {
        id: String(next.schedule.id),
        title: next.schedule.title,
        time: next.schedule.time,
        message: next.schedule.message,
        execTime: next.execTime.toISOString(),
        minutesLeft: next.diff
      }
    }

    return {
      botConfigured,
      botOnline,
      botUsername: bot ? bot.username : null,
      totalGroups,
      totalChannels,
      overallGroupsCount,
      activeSchedules: activeSchedulesCount,
      totalSchedules: schedules.length,
      messagesSent,
      failedDeliveries,
      successRate,
      totalLogs,
      sentToday,
      failedToday,
      nextSchedule
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to calculate dashboard statistics: ${error.message}`
    })
  }
})
