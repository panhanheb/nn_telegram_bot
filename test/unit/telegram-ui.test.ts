import { describe, it, expect } from 'vitest'
import {
  getTelegramSenderColorIndex,
  formatTelegramMessageTime,
  formatTelegramChatListTime,
  isClusterBoundary
} from '../../app/utils/telegram-ui'
import type { ChatMessage } from '../../app/stores/chat'

describe('Telegram UI Helpers', () => {
  describe('getTelegramSenderColorIndex', () => {
    it('returns an integer within range 0 to 6', () => {
      for (const name of ['Alice', 'Bob', 'Charlie', 'TelegramBot', 'Admin', 'David']) {
        const idx = getTelegramSenderColorIndex(name)
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThan(7)
      }
    })

    it('returns deterministic color index for same name or id', () => {
      expect(getTelegramSenderColorIndex('Alice')).toBe(getTelegramSenderColorIndex('Alice'))
      expect(getTelegramSenderColorIndex(undefined, 77)).toBe(77 % 7)
    })
  })

  describe('formatTelegramMessageTime', () => {
    it('formats ISO string to HH:MM format', () => {
      const formatted = formatTelegramMessageTime('2026-10-27T14:30:00.000Z')
      expect(formatted).toMatch(/^\d{2}:\d{2}$/)
    })

    it('handles invalid date gracefully', () => {
      expect(formatTelegramMessageTime('invalid-date')).toBe('')
    })
  })

  describe('formatTelegramChatListTime', () => {
    it('returns empty string for null or empty string', () => {
      expect(formatTelegramChatListTime(undefined)).toBe('')
    })

    it('formats today timestamp as HH:MM', () => {
      const now = new Date().toISOString()
      expect(formatTelegramChatListTime(now)).toMatch(/^\d{2}:\d{2}$/)
    })
  })

  describe('isClusterBoundary', () => {
    const now = Date.now()
    const msgs: ChatMessage[] = [
      {
        id: '1',
        chatId: '-100',
        messageId: 1,
        fromId: 1,
        fromName: 'Alice',
        isBot: false,
        direction: 'in',
        text: 'Hi',
        date: new Date(now).toISOString()
      },
      {
        id: '2',
        chatId: '-100',
        messageId: 2,
        fromId: 1,
        fromName: 'Alice',
        isBot: false,
        direction: 'in',
        text: 'How are you?',
        date: new Date(now + 1000).toISOString()
      },
      {
        id: '3',
        chatId: '-100',
        messageId: 3,
        fromId: 2,
        fromName: 'Bob',
        isBot: false,
        direction: 'out',
        text: 'I am good!',
        date: new Date(now + 2000).toISOString()
      }
    ]

    it('correctly identifies start and end of clusters', () => {
      // First Alice message: start of cluster, not end
      const first = isClusterBoundary(msgs, 0)
      expect(first.isFirst).toBe(true)
      expect(first.isLast).toBe(false)

      // Second Alice message: end of cluster, not start
      const second = isClusterBoundary(msgs, 1)
      expect(second.isFirst).toBe(false)
      expect(second.isLast).toBe(true)

      // Bob message: both start and end (single message cluster)
      const third = isClusterBoundary(msgs, 2)
      expect(third.isFirst).toBe(true)
      expect(third.isLast).toBe(true)
    })
  })
})
