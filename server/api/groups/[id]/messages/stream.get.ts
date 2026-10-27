import { resolveGroup } from '../../../../utils/group-resolver'
import { realtimeHub, type RealtimeChatEvent } from '../../../../utils/realtime'

/**
 * Server-Sent Events (SSE) stream endpoint for real-time Telegram group chat.
 * Streams incoming messages, deletions, edits, and typing status with zero latency.
 * Compatible with Cloudflare Workers and Node.js/Docker runtimes.
 */
export default defineEventHandler(async (event) => {
  const idStr = getRouterParam(event, 'id')
  if (!idStr) {
    throw createError({ statusCode: 400, statusMessage: 'Group ID is required' })
  }

  const group = await resolveGroup(idStr)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group "${idStr}" not found` })
  }

  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  })

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial handshake
      const connectedPayload: RealtimeChatEvent = {
        type: 'connected',
        chatId: group.chatId
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(connectedPayload)}\n\n`))

      // 2. Subscribe to realtime events for this chat
      unsubscribe = realtimeHub.subscribe(group.chatId, (evt) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`))
        } catch (err) {
          console.error('[SSE] Failed to enqueue event:', err)
        }
      })

      // 3. Heartbeat ping every 15s to keep proxy connections alive
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          if (heartbeatTimer) clearInterval(heartbeatTimer)
        }
      }, 15000)
    },
    cancel() {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
        heartbeatTimer = null
      }
    }
  })

  return stream
})
