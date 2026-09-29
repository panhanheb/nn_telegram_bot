import { db, JSONLog } from '../../utils/db'

// Moderation activity derived from the message log written by server/utils/moderation.ts.
// Only log lines produced by moderation are counted; the log keeps the latest 1000
// entries across all features, so the window may be shorter than requested.

type ActionKind = 'link' | 'sticker' | 'file' | 'keyword' | 'mute' | 'mute_failed' | 'manual'

interface ParsedAction {
  kind: ActionKind
  who: string
  detail: string
}

const AUTO_DELETE_RE = /^🧹 Auto-deleted (sticker|link|file|keyword)(?: \((.*)\))? from (.+)$/s
const MUTED_RE = /^🔇 Muted (.+) for (\d+) min after (\d+) warnings$/s
const MUTE_FAILED_RE = /^Mute failed for (.+?): (.*)$/s
const MANUAL_RE = /^🗑️ (.+?) removed a message via reply-command: (.*)$/s

function parseAction(message: string): ParsedAction | null {
  let m = message.match(AUTO_DELETE_RE)
  if (m) {
    const detail = (m[2] || '').replace(/^"(.*)"$/s, '$1')
    return { kind: m[1] as ActionKind, who: m[3] || '', detail }
  }
  m = message.match(MUTED_RE)
  if (m) return { kind: 'mute', who: m[1] || '', detail: `${m[2]} min after ${m[3]} warnings` }
  m = message.match(MUTE_FAILED_RE)
  if (m) return { kind: 'mute_failed', who: m[1] || '', detail: m[2] || '' }
  m = message.match(MANUAL_RE)
  if (m) return { kind: 'manual', who: m[1] || '', detail: (m[2] || '').replace(/^"(.*)"$/s, '$1') }
  return null
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const days = Math.min(90, Math.max(1, parseInt(query.days as string) || 7))
    const recentLimit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 15))

    const [logs, groups] = await Promise.all([db.getLogs(), db.getGroups()])
    const now = Date.now()
    const since = now - days * 24 * 60 * 60 * 1000

    const counts: Record<ActionKind, number> = {
      link: 0, sticker: 0, file: 0, keyword: 0, mute: 0, mute_failed: 0, manual: 0
    }

    const parsed: { log: JSONLog; action: ParsedAction; time: number }[] = []
    let oldest = Infinity
    for (const log of logs) {
      const time = new Date(log.sentAt).getTime()
      if (Number.isFinite(time) && time < oldest) oldest = time
      const action = parseAction(log.message || '')
      if (!action) continue
      parsed.push({ log, action, time })
      if (Number.isFinite(time) && time >= since) counts[action.kind]++
    }

    parsed.sort((a, b) => b.time - a.time)

    const recent = parsed.slice(0, recentLimit).map(({ log, action }) => {
      const group = log.groupId ? groups.find(g => g.id === log.groupId) : null
      return {
        id: log.id,
        kind: action.kind,
        who: action.who,
        detail: action.detail,
        group: group ? group.name : (log.chatTitle || 'Unknown chat'),
        status: log.status,
        sentAt: log.sentAt
      }
    })

    // If the oldest retained log is newer than the window start, older entries
    // were rotated out and the counts cover a shorter span than requested.
    const historyStart = Number.isFinite(oldest) ? oldest : null
    const truncated = historyStart !== null && logs.length >= 1000 && historyStart > since

    return {
      days,
      since: new Date(truncated && historyStart ? historyStart : since).toISOString(),
      truncated,
      counts,
      totalInWindow: Object.values(counts).reduce((a, b) => a + b, 0),
      recent
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch moderation activity: ${error.message}`
    })
  }
})
