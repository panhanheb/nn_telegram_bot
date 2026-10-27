import type { JSONChatMessage } from './db'

export type RealtimeChatEvent =
  | { type: 'connected'; chatId: string }
  | { type: 'message:new'; chatId: string; message: JSONChatMessage }
  | { type: 'message:delete'; chatId: string; messageId: number }
  | { type: 'message:update'; chatId: string; message: JSONChatMessage }
  | { type: 'chat:typing'; chatId: string; user: { name: string; isBot: boolean } }
  | { type: 'chat:cleared'; chatId: string }

export type RealtimeListener = (event: RealtimeChatEvent) => void

/**
 * In-memory PubSub event hub for real-time live chat updates.
 * Compatible with both Node.js/Docker and Cloudflare Workers runtime.
 */
class RealtimeHub {
  private listeners: Map<string, Set<RealtimeListener>> = new Map()

  subscribe(chatId: string, listener: RealtimeListener): () => void {
    if (!this.listeners.has(chatId)) {
      this.listeners.set(chatId, new Set())
    }
    const set = this.listeners.get(chatId)!
    set.add(listener)

    return () => {
      set.delete(listener)
      if (set.size === 0) {
        this.listeners.delete(chatId)
      }
    }
  }

  publish(chatId: string, event: RealtimeChatEvent): void {
    const set = this.listeners.get(chatId)
    if (set) {
      for (const listener of set) {
        try {
          listener(event)
        } catch (err) {
          console.error('[RealtimeHub] Listener execution error:', err)
        }
      }
    }
  }

  emitMessage(message: JSONChatMessage): void {
    this.publish(message.chatId, {
      type: 'message:new',
      chatId: message.chatId,
      message
    })
  }

  emitDelete(chatId: string, messageId: number): void {
    this.publish(chatId, {
      type: 'message:delete',
      chatId,
      messageId
    })
  }

  emitUpdate(message: JSONChatMessage): void {
    this.publish(message.chatId, {
      type: 'message:update',
      chatId: message.chatId,
      message
    })
  }

  emitTyping(chatId: string, user: { name: string; isBot: boolean }): void {
    this.publish(chatId, {
      type: 'chat:typing',
      chatId,
      user
    })
  }

  emitCleared(chatId: string): void {
    this.publish(chatId, {
      type: 'chat:cleared',
      chatId
    })
  }

  getActiveSubscriberCount(chatId: string): number {
    return this.listeners.get(chatId)?.size ?? 0
  }
}

export const realtimeHub = new RealtimeHub()
