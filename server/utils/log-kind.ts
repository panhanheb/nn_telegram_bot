import type { JSONLog } from './db'

// Logs record every bot action (sends, moderation, AI replies, housekeeping).
// These helpers tell them apart by the conventions the server uses when writing them.

export type LogKind = 'broadcast' | 'manual' | 'moderation' | 'ai' | 'aiFailed' | 'system'

// Classify a log by the conventions the server uses when writing it.
export function classifyLog(l: JSONLog): LogKind {
  const msg = l.message || ''
  if (l.scheduleId !== null && l.scheduleId !== undefined) return 'broadcast'
  if (msg.startsWith('🧹 Auto-deleted') || msg.startsWith('🔇 Muted')) return 'moderation'
  if (msg.startsWith('🗑️') && msg.includes('removed a message')) return 'moderation'
  if (msg.startsWith('🤖 AI replied')) return 'ai'
  if (msg.startsWith('AI reply failed') || msg.startsWith('AI reply skipped')) return 'aiFailed'
  if (
    msg.startsWith('🗑️ Deleted message') ||
    msg.startsWith('🧹 Cleared chat history') ||
    msg.startsWith('Reply-command delete failed') ||
    msg.startsWith('Mute failed')
  ) {
    return 'system'
  }
  return 'manual'
}

// A real outbound send: a scheduled broadcast or a message sent from the dashboard.
export function isDeliveryLog(l: JSONLog): boolean {
  const kind = classifyLog(l)
  return kind === 'broadcast' || kind === 'manual'
}
