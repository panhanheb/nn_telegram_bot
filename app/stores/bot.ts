import { defineStore } from 'pinia'

export interface BotInfo {
  id: number
  username: string
  firstName: string
  active: boolean
  permissions: {
    can_join_groups: boolean
    can_read_all_group_messages: boolean
    supports_inline_queries: boolean
  }
  status: 'ONLINE' | 'OFFLINE'
  createdAt: string
}

export const useBotStore = defineStore('bot', {
  state: () => ({
    bot: null as BotInfo | null,
    isLoading: false
  }),

  getters: {
    isConfigured: (state) => state.bot !== null,
    isOnline: (state) => !!state.bot && state.bot.active && state.bot.status === 'ONLINE'
  },

  actions: {
    async fetchBot() {
      this.isLoading = true
      try {
        const data = await $fetch<BotInfo | null>('/api/bot')
        this.bot = data
      } catch (error) {
        console.error('Failed to fetch bot settings:', error)
      } finally {
        this.isLoading = false
      }
    },

    async saveBot(token: string) {
      this.isLoading = true
      try {
        const data = await $fetch<{ success: boolean; bot: BotInfo }>('/api/bot', {
          method: 'POST',
          body: { token }
        })
        if (data.success) {
          this.bot = data.bot
        }
        return data
      } finally {
        this.isLoading = false
      }
    },

    async toggleBotStatus(active: boolean) {
      try {
        const data = await $fetch<{ success: boolean; bot: BotInfo }>('/api/bot', {
          method: 'PUT',
          body: { active }
        })
        if (data.success) {
          this.bot = data.bot
        }
        return data
      } catch (error) {
        console.error('Failed to toggle bot status:', error)
        throw error
      }
    },

    async deleteBot() {
      this.isLoading = true
      try {
        const data = await $fetch<{ success: boolean }>('/api/bot', {
          method: 'DELETE'
        })
        if (data.success) {
          this.bot = null
        }
        return data
      } finally {
        this.isLoading = false
      }
    },

    async verifyBot() {
      this.isLoading = true
      try {
        const data = await $fetch<{ success: boolean; status: 'ONLINE' | 'OFFLINE'; message?: string; bot: BotInfo }>('/api/bot/verify', {
          method: 'POST'
        })
        if (data.bot) {
          this.bot = data.bot
        }
        return data
      } finally {
        this.isLoading = false
      }
    },

    async testMessage(chatId: string, message: string) {
      this.isLoading = true
      try {
        const data = await $fetch<{ success: boolean; log: any }>('/api/bot/test', {
          method: 'POST',
          body: { chatId, message }
        })
        return data
      } finally {
        this.isLoading = false
      }
    }
  }
})
