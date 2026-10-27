import { describe, it, expect, vi } from 'vitest'
import { realtimeHub, type RealtimeChatEvent } from '../../server/utils/realtime'
import type { JSONChatMessage } from '../../server/utils/db'

describe('RealtimeHub PubSub Engine', () => {
  const dummyChatId = '-1001234567890'
  const dummyMessage: JSONChatMessage = {
    id: 'msg-uuid-1',
    chatId: dummyChatId,
    messageId: 101,
    fromId: 12345,
    fromName: 'Alice',
    fromUsername: 'alice',
    isBot: false,
    direction: 'in',
    text: 'Hello from Telegram',
    date: new Date().toISOString()
  }

  it('subscribes and receives published message:new events', () => {
    const received: RealtimeChatEvent[] = []
    const unsub = realtimeHub.subscribe(dummyChatId, (evt) => {
      received.push(evt)
    })

    expect(realtimeHub.getActiveSubscriberCount(dummyChatId)).toBeGreaterThanOrEqual(1)

    realtimeHub.emitMessage(dummyMessage)

    expect(received.length).toBe(1)
    expect(received[0]?.type).toBe('message:new')
    if (received[0]?.type === 'message:new') {
      expect(received[0].message.text).toBe('Hello from Telegram')
    }

    unsub()
  })

  it('unsubscribes cleanly and decreases listener count', () => {
    const fn = vi.fn()
    const unsub = realtimeHub.subscribe('test-channel-2', fn)
    expect(realtimeHub.getActiveSubscriberCount('test-channel-2')).toBe(1)

    unsub()
    expect(realtimeHub.getActiveSubscriberCount('test-channel-2')).toBe(0)

    realtimeHub.emitDelete('test-channel-2', 999)
    expect(fn).not.toHaveBeenCalled()
  })

  it('broadcasts message:delete and chat:cleared events', () => {
    const events: RealtimeChatEvent[] = []
    const unsub = realtimeHub.subscribe(dummyChatId, (evt) => events.push(evt))

    realtimeHub.emitDelete(dummyChatId, 101)
    realtimeHub.emitCleared(dummyChatId)

    expect(events.length).toBe(2)
    expect(events[0]?.type).toBe('message:delete')
    expect(events[1]?.type).toBe('chat:cleared')

    unsub()
  })

  it('broadcasts typing indicators correctly', () => {
    const events: RealtimeChatEvent[] = []
    const unsub = realtimeHub.subscribe(dummyChatId, (evt) => events.push(evt))

    realtimeHub.emitTyping(dummyChatId, { name: 'Bob', isBot: false })

    expect(events.length).toBe(1)
    expect(events[0]?.type).toBe('chat:typing')
    if (events[0]?.type === 'chat:typing') {
      expect(events[0].user.name).toBe('Bob')
    }

    unsub()
  })
})
