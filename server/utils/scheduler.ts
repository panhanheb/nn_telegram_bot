import { db, JSONSchedule, JSONGroup } from './db'
import { decryptToken, encryptToken } from './crypto'
import {
  verifyTelegramBot,
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramVideo,
  sendTelegramDocument
} from './telegram'

// Sequential delay helper (Telegram rate-limit protection)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Helper to check if a single field of a cron expression matches the value
function matchCronField(field: string, val: number): boolean {
  if (field === '*') return true

  // Lists e.g., 1,2,5
  if (field.includes(',')) {
    return field.split(',').some(f => matchCronField(f, val))
  }

  // Ranges e.g., 1-5
  const rangeMatch = field.match(/^(\d+)-(\d+)$/)
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10)
    const end = parseInt(rangeMatch[2], 10)
    return val >= start && val <= end
  }

  // Steps e.g., */5 or 1-10/2
  const stepParts = field.split('/')
  if (stepParts.length === 2) {
    const rangePart = stepParts[0]
    const step = parseInt(stepParts[1], 10)
    if (rangePart === '*') {
      return val % step === 0
    }
    const rangeMatch2 = rangePart.match(/^(\d+)-(\d+)$/)
    if (rangeMatch2) {
      const start = parseInt(rangeMatch2[1], 10)
      const end = parseInt(rangeMatch2[2], 10)
      if (val >= start && val <= end) {
        return (val - start) % step === 0
      }
    }
  }

  // Exact match
  return parseInt(field, 10) === val
}

// Full cron expression matcher (minute hour day-of-month month day-of-week)
function matchCronExpression(
  expression: string,
  minute: number,
  hour: number,
  day: number,
  month: number,
  dayOfWeek: number
): boolean {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) {
    return false // Only support standard 5-field cron
  }
  return (
    matchCronField(fields[0], minute) &&
    matchCronField(fields[1], hour) &&
    matchCronField(fields[2], day) &&
    matchCronField(fields[3], month) &&
    matchCronField(fields[4], dayOfWeek)
  )
}

const isValidChatId = (v: string) => /^-?\d+$/.test(v) || /^@[A-Za-z0-9_]{3,}$/.test(v)

// Cloudflare cron triggers are best-effort: a tick can arrive late or be
// dropped entirely. Matching the wall clock exactly ("08:00" === "08:00")
// therefore loses the broadcast whenever the 08:00 tick slips to 08:01.
// Instead we treat a schedule as due for this many minutes after its slot and
// rely on lastExecutedAt to keep the catch-up from re-sending.
const MISSED_RUN_GRACE_MINUTES = 10
const MINUTES_PER_DAY = 24 * 60

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
}

interface TzParts {
  minute: number
  hour: number
  day: number
  month: number
  dayOfWeek: number
}

// Read the wall-clock fields of `date` as seen in `timeZone`.
//
// The previous implementation did `new Date(date.toLocaleString('en-US', { timeZone }))`,
// which round-trips through a locale string and depends on the host's ability
// to re-parse it. formatToParts gives us the numbers directly.
function getTzParts(date: Date, timeZone: string): TzParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short'
  }).formatToParts(date)

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''

  return {
    minute: parseInt(get('minute'), 10),
    // en-US with hour12:false reports midnight as "24" in some runtimes.
    hour: parseInt(get('hour'), 10) % 24,
    day: parseInt(get('day'), 10),
    month: parseInt(get('month'), 10),
    dayOfWeek: WEEKDAY_INDEX[get('weekday')] ?? 0
  }
}

const truncateToMinute = (date: Date) => new Date(Math.floor(date.getTime() / 60000) * 60000)

/**
 * Decide whether `schedule` has an occurrence that is due at `now`, allowing
 * for a late cron tick.
 *
 * Returns the instant that occurrence was supposed to fire at, or null. The
 * caller compares it against lastExecutedAt so a slot only ever fires once.
 */
function findDueOccurrence(schedule: JSONSchedule, now: Date): Date | null {
  const tz = schedule.timezone || 'Asia/Phnom_Penh'
  const currentMinute = truncateToMinute(now)

  let parts: TzParts
  try {
    parts = getTzParts(now, tz)
  } catch {
    console.error(`[Cron] Invalid timezone "${tz}" in schedule "${schedule.title}", skipping.`)
    return null
  }

  // Cron expressions can match any minute, so walk backwards through the grace
  // window and take the most recent minute the expression matched.
  if (schedule.type === 'cron') {
    for (let ago = 0; ago <= MISSED_RUN_GRACE_MINUTES; ago++) {
      const candidate = new Date(currentMinute.getTime() - ago * 60000)
      const p = getTzParts(candidate, tz)
      if (matchCronExpression(schedule.time, p.minute, p.hour, p.day, p.month, p.dayOfWeek)) {
        return candidate
      }
    }
    return null
  }

  // Fixed HH:MM schedules.
  const [rawHour, rawMinute] = schedule.time.split(':')
  const scheduledMinutes = parseInt(rawHour, 10) * 60 + parseInt(rawMinute, 10)
  if (Number.isNaN(scheduledMinutes)) {
    console.error(`[Cron] Invalid time "${schedule.time}" in schedule "${schedule.title}", skipping.`)
    return null
  }

  // How long ago the slot passed, wrapping so a 23:58 slot is still reachable
  // from 00:03 the next day.
  let minutesLate = parts.hour * 60 + parts.minute - scheduledMinutes
  if (minutesLate < 0) minutesLate += MINUTES_PER_DAY
  if (minutesLate > MISSED_RUN_GRACE_MINUTES) return null

  const occurrence = new Date(currentMinute.getTime() - minutesLate * 60000)

  // Day constraints belong to the day the slot fell on, which is not always
  // "today" once the wrap above applies.
  const occurrenceParts = getTzParts(occurrence, tz)

  if (schedule.type === 'weekly' && schedule.dayOfWeek !== occurrenceParts.dayOfWeek) return null
  if (schedule.type === 'monthly' && schedule.dayOfMonth !== occurrenceParts.day) return null
  if (schedule.type === 'one_time' && schedule.lastExecutedAt) return null

  return occurrence
}

export async function syncEnvironmentVariables() {
  try {
    const config = useRuntimeConfig()
    const envToken = (config.telegramBotToken || '').trim()
    const envChatId = (config.telegramGroupChatId || '').trim()

    if (envToken) {
      const existing = await db.getBot()
      let sameToken = false
      if (existing) {
        try {
          sameToken = (await decryptToken(existing.token)) === envToken
        } catch {}
      }

      if (!existing || !sameToken) {
        console.log('[Init] Syncing Telegram Bot Token from environment variable...')
        const encrypted = await encryptToken(envToken)
        let username = 'EnvBot'
        let firstName = 'Env Bot'
        let permissions = {
          can_join_groups: true,
          can_read_all_group_messages: true,
          supports_inline_queries: false
        }
        try {
          const info = await verifyTelegramBot(envToken)
          username = info.username || username
          firstName = info.first_name || firstName
          permissions = {
            can_join_groups: info.can_join_groups,
            can_read_all_group_messages: info.can_read_all_group_messages,
            supports_inline_queries: info.supports_inline_queries
          }
        } catch (e: any) {
          console.warn('[Init] Failed to verify Telegram Bot Token from env:', e.message)
        }
        await db.setBot(encrypted, username, firstName, permissions, true)
        console.log('[Init] Telegram Bot Token synced successfully.')
      }
    }

    if (envChatId && isValidChatId(envChatId)) {
      const existing = await db.getGroupByChatId(envChatId)
      if (!existing) {
        console.log('[Init] Adding Telegram Group from environment chat ID:', envChatId)
        await db.createGroup('Default Group (Env)', envChatId, 'group', true)
      }
    } else if (envChatId) {
      console.warn(`[Init] TELEGRAM_GROUP_CHAT_ID "${envChatId}" is not a valid chat ID. Skipping auto-seed.`)
    }
  } catch (error: any) {
    console.error('[Init] Error syncing environment variables:', error.message)
  }
}

export async function seedDefaultSchedules() {
  try {
    const schedules = await db.getSchedules()
    if (schedules.length === 0) {
      console.log('[Cron] Seeding default schedules...')
      await db.createSchedule('Morning Message', 'Good morning everyone 🌞', '08:00', 'daily', 'Asia/Phnom_Penh', 'text', '', 'HTML')
      await db.createSchedule('Lunch Reminder', 'Good afternoon ☀️', '12:00', 'daily', 'Asia/Phnom_Penh', 'text', '', 'HTML')
      await db.createSchedule('Evening Message', 'Good evening 🌙', '17:00', 'daily', 'Asia/Phnom_Penh', 'text', '', 'HTML')
      console.log('[Cron] Default schedules seeded successfully!')
    }
  } catch (error) {
    console.error('[Cron] Failed to seed default schedules:', error)
  }
}

// Dispatch a schedule's message to every active target, sequentially with a
// 500ms delay between sends to stay within Telegram rate limits.
async function dispatchSchedule(schedule: JSONSchedule, groups: JSONGroup[], token: string) {
  for (const group of groups) {
    let response: any = null
    try {
      if (schedule.messageType === 'photo' && schedule.mediaUrl) {
        response = await sendTelegramPhoto(token, group.chatId, schedule.mediaUrl, schedule.message, schedule.parseMode)
      } else if (schedule.messageType === 'video' && schedule.mediaUrl) {
        response = await sendTelegramVideo(token, group.chatId, schedule.mediaUrl, schedule.message, schedule.parseMode)
      } else if (schedule.messageType === 'document' && schedule.mediaUrl) {
        response = await sendTelegramDocument(token, group.chatId, schedule.mediaUrl, schedule.message, schedule.parseMode)
      } else {
        response = await sendTelegramMessage(token, group.chatId, schedule.message, schedule.parseMode)
      }

      await db.createLog(group.id, group.name, schedule.id, schedule.message, 'SUCCESS', null, response)
      console.log(`[Cron] Sent "${schedule.title}" to ${group.name} (${group.chatId}).`)
    } catch (sendError: any) {
      await db.createLog(group.id, group.name, schedule.id, schedule.message, 'FAILED', sendError.message)
      console.error(`[Cron] Failed to send "${schedule.title}" to ${group.name}:`, sendError.message)
    }

    // Rate-limit safeguard between sequential dispatches
    await delay(500)
  }
}

/**
 * Runs one scheduler tick. Invoked every minute by the Cloudflare cron trigger.
 *
 * `force` dispatches every active schedule regardless of its slot, for manual
 * testing via POST /api/schedules/run.
 *
 * The `skipped` reason in the result is what to look at when broadcasts are
 * not arriving — each early return says which precondition failed.
 */
export async function runScheduledBroadcast(now = new Date(), options: { force?: boolean } = {}) {
  const { force = false } = options

  await syncEnvironmentVariables()
  await seedDefaultSchedules()

  const schedules = await db.getSchedules()
  const activeSchedules = schedules.filter(s => s.active)
  if (activeSchedules.length === 0) {
    return { dispatched: 0, skipped: 'no active schedules' }
  }

  // Single bot must be configured and active to broadcast
  const bot = await db.getBot()
  if (!bot) return { dispatched: 0, skipped: 'no bot configured' }
  if (!bot.active) return { dispatched: 0, skipped: 'bot is disabled' }

  let token = ''
  try {
    token = await decryptToken(bot.token)
  } catch (e: any) {
    console.error('[Cron] Failed to decrypt bot token:', e.message)
    return { dispatched: 0, skipped: `bot token could not be decrypted: ${e.message}` }
  }

  const groups = await db.getGroups()
  const activeGroups = groups.filter(g => g.active)
  if (activeGroups.length === 0) {
    return { dispatched: 0, skipped: 'no active target groups' }
  }

  let dispatched = 0

  for (const schedule of activeSchedules) {
    const occurrence = force ? truncateToMinute(now) : findDueOccurrence(schedule, now)
    if (!occurrence) continue

    // The grace window means a slot can stay "due" across several ticks, and
    // Cloudflare may deliver the same trigger more than once. Anything already
    // sent at or after this slot's own start time has been handled.
    if (!force && schedule.lastExecutedAt && new Date(schedule.lastExecutedAt) >= occurrence) continue

    const minutesLate = Math.round((now.getTime() - occurrence.getTime()) / 60000)
    console.log(
      `[Cron] Schedule "${schedule.title}" is due for ${occurrence.toISOString()}` +
      `${minutesLate > 0 ? ` (${minutesLate}m late)` : ''}. Dispatching broadcasts...`
    )

    // Restrict this schedule to its selected target groups. An empty/undefined
    // list means "all active groups" (the original broadcast behaviour).
    const targetIds = schedule.targetGroupIds
    const scheduleGroups =
      targetIds && targetIds.length > 0
        ? activeGroups.filter(g => targetIds.includes(g.id))
        : activeGroups

    if (scheduleGroups.length === 0) {
      console.log(`[Cron] Schedule "${schedule.title}" has no active target groups, skipping.`)
      continue
    }

    // Claim the slot before sending. A tick that overruns into the next minute
    // would otherwise let the following tick dispatch the same slot again.
    //
    // Caveat: this guard is only as fresh as KV, which is eventually consistent
    // (a read can be served from edge cache for up to ~60s). A tick landing in
    // the grace window on a stale read can therefore still double-send. If
    // exactly-once matters, move the claim into a Durable Object.
    await db.updateSchedule(schedule.id, {
      lastExecutedAt: occurrence.toISOString(),
      active: schedule.type === 'one_time' ? false : schedule.active
    })

    await dispatchSchedule(schedule, scheduleGroups, token)
    dispatched++
  }

  return { dispatched, skipped: dispatched === 0 ? 'no schedule was due this minute' : null }
}
