import { defineStore } from 'pinia'

export interface AiSettings {
  enabled: boolean
  replyOnMention: boolean
  model: string
  systemPrompt: string
  maxTokens: number
  apiKey?: string
  hasCustomKey?: boolean
  keyConfigured?: boolean
}

export const useAiStore = defineStore('ai', {
  state: () => ({
    settings: {
      enabled: false,
      replyOnMention: true,
      model: 'gemini-flash-latest',
      systemPrompt: '',
      maxTokens: 600,
      keyConfigured: false
    } as AiSettings,
    isLoading: false
  }),

  actions: {
    async fetchSettings() {
      this.isLoading = true
      try {
        const data = await $fetch<AiSettings>('/api/ai')
        this.settings = data
      } catch (error) {
        console.error('Failed to fetch AI settings:', error)
      } finally {
        this.isLoading = false
      }
    },

    async updateSettings(partial: Partial<AiSettings>) {
      const data = await $fetch<{ success: boolean; settings: AiSettings }>('/api/ai', {
        method: 'PUT',
        body: partial
      })
      if (data.success) {
        this.settings = data.settings
      }
      return data
    }
  }
})
