import { ref, onBeforeUnmount, type Ref } from 'vue'
import { useChatStore, type ChatMessage } from '../stores/chat'

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export interface RealtimeTypingUser {
  name: string
  isBot: boolean
  timestamp: number
}

/**
 * Real-time SSE chat engine composable.
 * Connects to the server-sent events stream for the active Telegram chat,
 * receives instant message deliveries, deletes, edits, and typing signals.
 */
export function useRealtimeChat(groupIdRef: Ref<string | null>) {
  const chatStore = useChatStore()
  const status = ref<RealtimeStatus>('idle')
  const typingUsers = ref<RealtimeTypingUser[]>([])
  
  let eventSource: EventSource | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempts = 0
  let typingCleanupTimer: ReturnType<typeof setInterval> | null = null

  const cleanupTyping = () => {
    const now = Date.now()
    typingUsers.value = typingUsers.value.filter(u => now - u.timestamp < 5000)
  }

  const disconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (typingCleanupTimer) {
      clearInterval(typingCleanupTimer)
      typingCleanupTimer = null
    }
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    status.value = 'disconnected'
    typingUsers.value = []
  }

  const connect = () => {
    disconnect()
    const id = groupIdRef.value
    if (!id) {
      status.value = 'idle'
      return
    }

    status.value = reconnectAttempts > 0 ? 'reconnecting' : 'connecting'

    // Periodically remove stale typing indicators (older than 5s)
    typingCleanupTimer = setInterval(cleanupTyping, 2000)

    try {
      const url = `/api/groups/${encodeURIComponent(id)}/messages/stream`
      eventSource = new EventSource(url)

      eventSource.onopen = () => {
        status.value = 'connected'
        reconnectAttempts = 0
      }

      eventSource.onmessage = (e) => {
        if (!e.data || e.data === ': ping') return

        try {
          const payload = JSON.parse(e.data)

          switch (payload.type) {
            case 'connected':
              status.value = 'connected'
              break

            case 'message:new': {
              const msg: ChatMessage = payload.message
              if (!msg) break
              // Check if message is already in thread (e.g. from optimistic send or initial load)
              const idx = chatStore.messages.findIndex(
                m => (m.id && m.id === msg.id) || (m.messageId && msg.messageId && m.messageId === msg.messageId)
              )
              if (idx !== -1) {
                // Update existing message in place
                chatStore.messages[idx] = msg
              } else {
                chatStore.messages.push(msg)
              }
              break
            }

            case 'message:delete': {
              const messageId = payload.messageId
              if (typeof messageId === 'number') {
                chatStore.messages = chatStore.messages.filter(m => m.messageId !== messageId)
              }
              break
            }

            case 'message:update': {
              const msg: ChatMessage = payload.message
              if (!msg) break
              const idx = chatStore.messages.findIndex(
                m => (m.id && m.id === msg.id) || (m.messageId && msg.messageId && m.messageId === msg.messageId)
              )
              if (idx !== -1) {
                chatStore.messages[idx] = { ...chatStore.messages[idx], ...msg }
              }
              break
            }

            case 'chat:typing': {
              const user = payload.user
              if (user?.name) {
                const existing = typingUsers.value.find(u => u.name === user.name)
                if (existing) {
                  existing.timestamp = Date.now()
                } else {
                  typingUsers.value.push({
                    name: user.name,
                    isBot: !!user.isBot,
                    timestamp: Date.now()
                  })
                }
              }
              break
            }

            case 'chat:cleared': {
              chatStore.messages = []
              break
            }
          }
        } catch (err) {
          console.error('[RealtimeSSE] Failed to parse message event:', err)
        }
      }

      eventSource.onerror = () => {
        status.value = 'reconnecting'
        if (eventSource) {
          eventSource.close()
          eventSource = null
        }
        // Exponential backoff reconnect: 1s, 2s, 4s, 8s, up to 15s max
        const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttempts), 15000)
        reconnectAttempts++
        reconnectTimer = setTimeout(() => {
          connect()
        }, backoffMs)
      }
    } catch (err) {
      console.error('[RealtimeSSE] Error creating EventSource:', err)
      status.value = 'disconnected'
    }
  }

  onBeforeUnmount(() => {
    disconnect()
  })

  return {
    status,
    typingUsers,
    connect,
    disconnect
  }
}
