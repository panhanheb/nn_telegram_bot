import { defineStore } from 'pinia'

export interface ChatMember {
  chatId: string
  userId: number
  firstName?: string
  lastName?: string
  username?: string
  isBot: boolean
  status?: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked'
  messageCount: number
  firstSeen: string
  lastSeen: string
}

export interface ChatMessage {
  id: string
  chatId: string
  messageId: number | null
  fromId: number | null
  fromName: string
  fromUsername?: string
  isBot: boolean
  direction: 'in' | 'out'
  text: string
  date: string
  replyToMessageId?: number | null
  replyToName?: string
  replyToText?: string
  mediaType?: 'photo' | 'sticker' | 'video' | 'animation' | 'document' | 'audio' | 'voice'
  mediaFileId?: string
  mediaMime?: string
  mediaEmoji?: string
  mediaFileName?: string
  stickerFormat?: 'static' | 'animated' | 'video'
}

export interface ReplyTarget {
  messageId: number
  name: string
  text: string
}

interface MembersResponse {
  groupId: string
  chatId: string
  name: string
  totalCount: number | null
  knownCount: number
  adminError: string | null
  members: ChatMember[]
}

interface MessagesResponse {
  groupId: string
  chatId: string
  name: string
  messages: ChatMessage[]
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [] as ChatMessage[],
    members: [] as ChatMember[],
    totalCount: null as number | null,
    adminError: null as string | null,
    isLoadingMessages: false,
    isLoadingMembers: false,
    isSending: false
  }),

  actions: {
    async fetchMessages(groupId: string) {
      this.isLoadingMessages = true
      try {
        const data = await $fetch<MessagesResponse>(`/api/groups/${groupId}/messages`)
        this.messages = data.messages
      } catch (error) {
        console.error('Failed to fetch messages:', error)
      } finally {
        this.isLoadingMessages = false
      }
    },

    async fetchMembers(groupId: string) {
      this.isLoadingMembers = true
      try {
        const data = await $fetch<MembersResponse>(`/api/groups/${groupId}/members`)
        this.members = data.members
        this.totalCount = data.totalCount
        this.adminError = data.adminError
      } catch (error) {
        console.error('Failed to fetch members:', error)
      } finally {
        this.isLoadingMembers = false
      }
    },

    async sendMessage(
      groupId: string,
      message: string,
      replyTo?: ReplyTarget | null,
      parseMode: 'HTML' | 'MarkdownV2' = 'HTML'
    ) {
      this.isSending = true
      try {
        const data = await $fetch<{ success: boolean; message: ChatMessage }>(
          `/api/groups/${groupId}/messages`,
          {
            method: 'POST',
            body: {
              message,
              parseMode,
              replyToMessageId: replyTo?.messageId,
              replyToName: replyTo?.name,
              replyToText: replyTo?.text
            }
          }
        )
        if (data.success) {
          this.messages.push(data.message)
        }
        return data
      } finally {
        this.isSending = false
      }
    },

    async sendSticker(
      groupId: string,
      sticker: { mediaFileId?: string; fileId?: string; url?: string; mediaEmoji?: string; emoji?: string; stickerFormat?: 'static' | 'animated' | 'video' },
      replyTo?: ReplyTarget | null
    ) {
      const target = sticker.fileId || sticker.url || sticker.mediaFileId
      if (!target) throw new Error('Sticker file is unavailable')
      this.isSending = true
      try {
        const data = await $fetch<{ success: boolean; message: ChatMessage }>(
          `/api/groups/${groupId}/messages`,
          {
            method: 'POST',
            body: {
              stickerFileId: target,
              stickerEmoji: sticker.emoji || sticker.mediaEmoji,
              stickerFormat: sticker.stickerFormat,
              replyToMessageId: replyTo?.messageId,
              replyToName: replyTo?.name,
              replyToText: replyTo?.text
            }
          }
        )
        if (data.success) this.messages.push(data.message)
        return data
      } finally {
        this.isSending = false
      }
    },

    async sendMedia(groupId: string, file: File, mediaType: 'photo' | 'video' | 'sticker', message = '', replyTo?: ReplyTarget | null) {
      this.isSending = true
      try {
        const form = new FormData()
        form.set('media', file)
        form.set('mediaType', mediaType)
        form.set('message', message)
        if (replyTo?.messageId) form.set('replyToMessageId', String(replyTo.messageId))
        if (replyTo?.name) form.set('replyToName', replyTo.name)
        if (replyTo?.text) form.set('replyToText', replyTo.text)
        const data = await $fetch<{ success: boolean; message: ChatMessage }>(
          `/api/groups/${groupId}/messages`,
          { method: 'POST', body: form }
        )
        if (data.success) this.messages.push(data.message)
        return data
      } finally {
        this.isSending = false
      }
    },

    async deleteMessage(groupId: string, messageId: number) {
      const data = await $fetch<{ success: boolean; deletedMessageId: number }>(
        `/api/groups/${groupId}/messages/${messageId}`,
        { method: 'DELETE' }
      )
      if (data.success) {
        this.messages = this.messages.filter(m => m.messageId !== messageId)
      }
      return data
    },

    async clearChat(groupId: string) {
      const data = await $fetch<{ success: boolean; removed: number }>(
        `/api/groups/${groupId}/messages`,
        { method: 'DELETE' }
      )
      if (data.success) {
        this.messages = []
      }
      return data
    },

    reset() {
      this.messages = []
      this.members = []
      this.totalCount = null
      this.adminError = null
    }
  }
})
