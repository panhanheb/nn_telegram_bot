import { db, type JSONLog } from '../../utils/db'
import { classifyLog } from '../../utils/log-kind'

// Aggregated, read-only analytics built from the stored logs, chat history and
// member registry. Nothing here is estimated: every number is a count of real
// records. When the stored history does not reach back far enough to cover the
// previous period (logs are capped at 1000, messages at 5000), the previous-
// period totals are returned as null so the UI can omit the trend.
//
// Query:
//   days — 7 | 14 | 30 | 90 (default 14)
//   tz   — the client's Date#getTimezoneOffset() in minutes, so days and hours
//          are bucketed in the viewer's local time (default 0 = UTC)

const ALLOWED_DAYS = [7, 14, 30, 90]
const DAY_MS = 24 * 60 * 60 * 1000
const LOG_CAP = 1000
const MESSAGE_CAP = 5000

interface Totals {
  received: number
  activeUsers: number
  outboundDelivered: number
  outboundFailed: number
  broadcastsDelivered: number
  broadcastsFailed: number
  moderation: number
  aiReplies: number
  newMembers: number
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const requestedDays = parseInt(query.days as string)
  const days = ALLOWED_DAYS.includes(requestedDays) ? requestedDays : 14
  const tzRaw = parseInt(query.tz as string)
  // Offsets outside ±14h are invalid; fall back to UTC.
  const tzOffsetMin = Number.isFinite(tzRaw) && Math.abs(tzRaw) <= 14 * 60 ? tzRaw : 0
  const shiftMs = -tzOffsetMin * 60 * 1000

  try {
    const [logs, messages, members, groups] = await Promise.all([
      db.getLogs(),
      db.getChatMessages(),
      db.getMembers(),
      db.getGroups()
    ])

    // Local-time helpers: shift into the viewer's zone, then read UTC fields.
    const localDayKey = (ts: number) => new Date(ts + shiftMs).toISOString().slice(0, 10)
    const localHour = (ts: number) => new Date(ts + shiftMs).getUTCHours()

    const now = Date.now()
    const shiftedNow = new Date(now + shiftMs)
    const localMidnightShifted = Date.UTC(
      shiftedNow.getUTCFullYear(),
      shiftedNow.getUTCMonth(),
      shiftedNow.getUTCDate()
    )
    // Real (UTC) timestamps of the current and previous period boundaries.
    const periodStart = localMidnightShifted - shiftMs - (days - 1) * DAY_MS
    const prevStart = periodStart - days * DAY_MS

    // Day buckets for the current period
    const series = Array.from({ length: days }, (_, i) => ({
      date: localDayKey(periodStart + i * DAY_MS),
      received: 0,
      broadcastsDelivered: 0,
      broadcastsFailed: 0,
      outboundDelivered: 0,
      outboundFailed: 0,
      moderation: 0,
      aiReplies: 0
    }))
    const seriesIndex = new Map(series.map((d, i) => [d.date, i]))

    const emptyTotals = (): Totals => ({
      received: 0,
      activeUsers: 0,
      outboundDelivered: 0,
      outboundFailed: 0,
      broadcastsDelivered: 0,
      broadcastsFailed: 0,
      moderation: 0,
      aiReplies: 0,
      newMembers: 0
    })
    const current = emptyTotals()
    const previous = emptyTotals()
    const hourly = Array.from({ length: 24 }, () => 0)

    const chatToGroup = new Map(groups.map(g => [g.chatId, g]))
    const groupActivity = new Map<string, { received: number; users: Set<number> }>()
    const currentUsers = new Set<string>()
    const previousUsers = new Set<string>()

    // --- Incoming chat messages (from real users, not bots) ---
    let oldestMessage = Infinity
    for (const m of messages) {
      const ts = new Date(m.date).getTime()
      if (!Number.isFinite(ts)) continue
      if (ts < oldestMessage) oldestMessage = ts
      if (m.direction !== 'in' || m.isBot) continue

      if (ts >= periodStart && ts <= now) {
        current.received++
        const hour = localHour(ts)
        hourly[hour] = (hourly[hour] ?? 0) + 1
        const idx = seriesIndex.get(localDayKey(ts))
        const day = idx !== undefined ? series[idx] : undefined
        if (day) day.received++
        if (m.fromId !== null) currentUsers.add(`${m.chatId}:${m.fromId}`)

        let g = groupActivity.get(m.chatId)
        if (!g) {
          g = { received: 0, users: new Set() }
          groupActivity.set(m.chatId, g)
        }
        g.received++
        if (m.fromId !== null) g.users.add(m.fromId)
      } else if (ts >= prevStart && ts < periodStart) {
        previous.received++
        if (m.fromId !== null) previousUsers.add(`${m.chatId}:${m.fromId}`)
      }
    }
    // Distinct people across all chats (a user in two groups counts once).
    const distinct = (set: Set<string>) => new Set([...set].map(k => k.split(':')[1])).size
    current.activeUsers = distinct(currentUsers)
    previous.activeUsers = distinct(previousUsers)

    // --- Logs: deliveries, moderation, AI ---
    let oldestLog = Infinity
    for (const l of logs) {
      const ts = new Date(l.sentAt).getTime()
      if (!Number.isFinite(ts)) continue
      if (ts < oldestLog) oldestLog = ts

      const inCurrent = ts >= periodStart && ts <= now
      const inPrevious = ts >= prevStart && ts < periodStart
      if (!inCurrent && !inPrevious) continue

      const bucket = inCurrent ? current : previous
      const idx = inCurrent ? seriesIndex.get(localDayKey(ts)) : undefined
      const day = idx !== undefined ? series[idx] : null
      const ok = l.status === 'SUCCESS'
      const kind = classifyLog(l)

      if (kind === 'broadcast' || kind === 'manual') {
        if (ok) {
          bucket.outboundDelivered++
          if (day) day.outboundDelivered++
        } else {
          bucket.outboundFailed++
          if (day) day.outboundFailed++
        }
      }
      if (kind === 'broadcast') {
        if (ok) {
          bucket.broadcastsDelivered++
          if (day) day.broadcastsDelivered++
        } else {
          bucket.broadcastsFailed++
          if (day) day.broadcastsFailed++
        }
      } else if (kind === 'moderation' && ok) {
        bucket.moderation++
        if (day) day.moderation++
      } else if (kind === 'ai' && ok) {
        bucket.aiReplies++
        if (day) day.aiReplies++
      }
    }

    // --- Members first observed by the bot ---
    let oldestMember = Infinity
    for (const mem of members) {
      if (mem.isBot) continue
      const ts = new Date(mem.firstSeen).getTime()
      if (!Number.isFinite(ts)) continue
      if (ts < oldestMember) oldestMember = ts
      if (ts >= periodStart && ts <= now) current.newMembers++
      else if (ts >= prevStart && ts < periodStart) previous.newMembers++
    }

    // Is the stored history complete for the previous period? If a store has
    // hit its cap and its oldest record is newer than prevStart, older records
    // were dropped and the previous-period counts would be understated.
    const logsComplete = logs.length < LOG_CAP || oldestLog <= prevStart
    const messagesComplete = messages.length < MESSAGE_CAP || oldestMessage <= prevStart

    const previousTotals = {
      received: messagesComplete ? previous.received : null,
      activeUsers: messagesComplete ? previous.activeUsers : null,
      outboundDelivered: logsComplete ? previous.outboundDelivered : null,
      outboundFailed: logsComplete ? previous.outboundFailed : null,
      broadcastsDelivered: logsComplete ? previous.broadcastsDelivered : null,
      broadcastsFailed: logsComplete ? previous.broadcastsFailed : null,
      moderation: logsComplete ? previous.moderation : null,
      aiReplies: logsComplete ? previous.aiReplies : null,
      // The member registry is never trimmed.
      newMembers: previous.newMembers
    }

    // --- Top groups by messages received this period ---
    const knownMembers = new Map<string, number>()
    for (const mem of members) {
      if (mem.isBot || mem.status === 'left' || mem.status === 'kicked') continue
      knownMembers.set(mem.chatId, (knownMembers.get(mem.chatId) || 0) + 1)
    }
    const topGroups = [...groupActivity.entries()]
      .map(([chatId, a]) => {
        const g = chatToGroup.get(chatId)
        return {
          chatId,
          id: g ? String(g.id) : null,
          name: g ? g.name : `Chat ${chatId}`,
          type: g ? g.type : null,
          received: a.received,
          activeUsers: a.users.size,
          knownMembers: knownMembers.get(chatId) || 0
        }
      })
      .sort((a, b) => b.received - a.received)
      .slice(0, 6)

    return {
      days,
      from: new Date(periodStart).toISOString(),
      to: new Date(now).toISOString(),
      tzOffset: tzOffsetMin,
      totals: current,
      previousTotals,
      series,
      hourly,
      topGroups,
      coverage: {
        logsComplete,
        messagesComplete,
        oldestLogAt: Number.isFinite(oldestLog) ? new Date(oldestLog).toISOString() : null,
        oldestMessageAt: Number.isFinite(oldestMessage) ? new Date(oldestMessage).toISOString() : null
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to build analytics summary: ${error.message}`
    })
  }
})
