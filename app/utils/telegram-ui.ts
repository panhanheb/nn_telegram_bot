import type { ChatMessage } from '../stores/chat'

/**
 * Telegram 7-color sender palette index (0..6)
 * Red, Orange, Violet, Green, Cyan, Blue, Pink
 */
export function getTelegramSenderColorIndex(name?: string, id?: number | null): number {
  if (typeof id === 'number' && id > 0) {
    return Math.abs(id) % 7
  }
  const str = (name || 'user').trim().toLowerCase()
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff
  }
  return Math.abs(hash) % 7
}

/**
 * Format timestamp in authentic Telegram message format (e.g. "14:28")
 */
export function formatTelegramMessageTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return ''
  }
}

/**
 * Format relative date for chat list (e.g. "14:28", "Yesterday", "Oct 24")
 */
export function formatTelegramChatListTime(isoString?: string): string {
  if (!isoString) return ''
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return ''
    const now = new Date()
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    }

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()

    if (isYesterday) {
      return 'Yesterday'
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

/**
 * Helper to determine cluster boundaries for Telegram bubbles:
 * - isFirstInCluster: Show avatar and sender name
 * - isLastInCluster: Show tail SVG on the bubble corner
 */
export function isClusterBoundary(messages: ChatMessage[], index: number) {
  const current = messages[index]
  if (!current) return { isFirst: true, isLast: true }

  const prev = index > 0 ? messages[index - 1] : null
  const next = index < messages.length - 1 ? messages[index + 1] : null

  const isSameSenderAsPrev =
    prev &&
    prev.direction === current.direction &&
    prev.fromName === current.fromName &&
    Math.abs(new Date(current.date).getTime() - new Date(prev.date).getTime()) < 5 * 60 * 1000

  const isSameSenderAsNext =
    next &&
    next.direction === current.direction &&
    next.fromName === current.fromName &&
    Math.abs(new Date(next.date).getTime() - new Date(current.date).getTime()) < 5 * 60 * 1000

  return {
    isFirst: !isSameSenderAsPrev,
    isLast: !isSameSenderAsNext
  }
}
