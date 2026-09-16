import { defineStore } from 'pinia'

export interface ModerationSettings {
  enabled: boolean
  deleteLinks: boolean
  deleteStickers: boolean
  deleteFiles: boolean
  blockedExtensions?: string[]
}

export const useModerationStore = defineStore('moderation', {
  state: () => ({
    settings: {
      enabled: false,
      deleteLinks: false,
      deleteStickers: false,
      deleteFiles: false,
      blockedExtensions: []
    } as ModerationSettings,
    isLoading: false
  }),

  actions: {
    async fetchSettings() {
      this.isLoading = true
      try {
        const data = await $fetch<ModerationSettings>('/api/moderation')
        this.settings = data
      } catch (error) {
        console.error('Failed to fetch moderation settings:', error)
      } finally {
        this.isLoading = false
      }
    },

    async updateSettings(partial: Partial<ModerationSettings>) {
      try {
        const data = await $fetch<{ success: boolean; settings: ModerationSettings }>('/api/moderation', {
          method: 'PUT',
          body: partial
        })
        if (data.success) {
          this.settings = data.settings
        }
        return data
      } catch (error) {
        console.error('Failed to update moderation settings:', error)
        throw error
      }
    }
  }
})
