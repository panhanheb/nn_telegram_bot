import { ref, computed } from 'vue'
import type { MessageLog } from '../stores/logs'

export type NotificationType = 'broadcast' | 'moderation' | 'ai' | 'error' | 'activity'

export interface NotificationItem {
  id: string
  title: string
  message: string
  date: string // ISO
  type: NotificationType
  targetTab: string
}

const SEEN_KEY = 'teleflow-notifications-seen'

// Shared across the topbar bell and the dropdown.
const items = ref<NotificationItem[]>([])
const seenAt = ref<number>(0)
const isLoading = ref(false)
let loadedOnce = false

function classify(log: MessageLog): NotificationItem {
  const text = log.message || ''
  const where = log.group?.name || 'Unknown chat'
  const base = { id: log.id, date: log.sentAt }

  if (log.status === 'FAILED') {
    return {
      ...base,
      type: 'error',
      title: log.schedule ? `Broadcast failed: ${log.schedule.title}` : 'Action failed',
      message: `${where}: ${log.error || text}`,
      targetTab: 'logs'
    }
  }
  if (log.scheduleId) {
    return {
      ...base,
      type: 'broadcast',
      title: `Broadcast sent: ${log.schedule?.title || 'Scheduled message'}`,
      message: where,
      targetTab: 'schedules'
    }
  }
  if (/auto-deleted|muted|removed a message/i.test(text)) {
    return { ...base, type: 'moderation', title: 'Moderation action', message: `${where}: ${stripEmoji(text)}`, targetTab: 'moderation' }
  }
  if (/ai replied/i.test(text)) {
    return { ...base, type: 'ai', title: 'AI reply', message: `${where}: ${stripEmoji(text)}`, targetTab: 'ai' }
  }
  return { ...base, type: 'activity', title: 'Activity', message: `${where}: ${stripEmoji(text)}`, targetTab: 'logs' }
}

function stripEmoji(text: string) {
  return text.replace(/^[^\p{L}\p{N}"@]+/u, '').trim()
}

export function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function useNotifications() {
  const load = async () => {
    if (isLoading.value) return
    isLoading.value = true
    try {
      if (!loadedOnce && import.meta.client) {
        try {
          seenAt.value = Number(localStorage.getItem(SEEN_KEY) || 0)
        } catch {}
      }
      const data = await $fetch<{ logs: MessageLog[] }>('/api/logs', { query: { page: 1, limit: 20 } })
      items.value = (data.logs || []).map(classify)
      loadedOnce = true
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      isLoading.value = false
    }
  }

  const isUnread = (item: NotificationItem) => new Date(item.date).getTime() > seenAt.value

  const unreadCount = computed(() => items.value.filter(isUnread).length)

  const markAllRead = () => {
    seenAt.value = Date.now()
    try {
      localStorage.setItem(SEEN_KEY, String(seenAt.value))
    } catch {}
  }

  return { items, isLoading, unreadCount, isUnread, load, markAllRead }
}
