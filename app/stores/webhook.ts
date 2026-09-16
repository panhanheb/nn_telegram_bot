import { defineStore } from 'pinia'

export interface WebhookInfo {
  configured: boolean
  url: string
  pendingUpdateCount: number
  lastError: string | null
}

export const useWebhookStore = defineStore('webhook', {
  state: () => ({
    info: {
      configured: false,
      url: '',
      pendingUpdateCount: 0,
      lastError: null
    } as WebhookInfo,
    isLoading: false
  }),

  actions: {
    async fetchInfo() {
      this.isLoading = true
      try {
        this.info = await $fetch<WebhookInfo>('/api/telegram/webhook')
      } catch (error) {
        console.error('Failed to fetch webhook info:', error)
      } finally {
        this.isLoading = false
      }
    },

    async setup() {
      this.isLoading = true
      try {
        const data = await $fetch<{ success: boolean; url: string }>('/api/telegram/webhook-setup', {
          method: 'POST'
        })
        if (data.success) {
          await this.fetchInfo()
        }
        return data
      } finally {
        this.isLoading = false
      }
    }
  }
})
