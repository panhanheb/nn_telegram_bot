import { defineStore } from 'pinia'

export interface ModerationSettings {
  enabled: boolean
  deleteLinks: boolean
  deleteStickers: boolean
  deleteFiles: boolean
  blockedExtensions?: string[]
  blockedKeywords: string[]
  exemptAdmins: boolean
  warnLimit: number
  muteMinutes: number
  rulesText: string
}

export type ModerationActionKind = 'link' | 'sticker' | 'file' | 'keyword' | 'mute' | 'mute_failed' | 'manual'

export interface ModerationAction {
  id: string
  kind: ModerationActionKind
  who: string
  detail: string
  group: string
  status: 'SUCCESS' | 'FAILED'
  sentAt: string
}

export interface ModerationActivity {
  days: number
  since: string
  truncated: boolean
  counts: Record<ModerationActionKind, number>
  totalInWindow: number
  recent: ModerationAction[]
}

export const useModerationStore = defineStore('moderation', {
  state: () => ({
    settings: {
      enabled: false,
      deleteLinks: false,
      deleteStickers: false,
      deleteFiles: false,
      blockedExtensions: [],
      blockedKeywords: [],
      exemptAdmins: true,
      warnLimit: 3,
      muteMinutes: 60,
      rulesText: ''
    } as ModerationSettings,
    isLoading: false,
    activity: null as ModerationActivity | null,
    isLoadingActivity: false,
    activityError: null as string | null
  }),

  actions: {
    async fetchSettings() {
      this.isLoading = true
      try {
        const data = await $fetch<ModerationSettings>('/api/moderation')
        this.settings = { ...data, blockedKeywords: data.blockedKeywords || [] }
      } catch (error) {
        console.error('Failed to fetch moderation settings:', error)
      } finally {
        this.isLoading = false
      }
    },

    async fetchActivity(days = 7) {
      this.isLoadingActivity = true
      this.activityError = null
      try {
        this.activity = await $fetch<ModerationActivity>('/api/moderation/activity', {
          query: { days, limit: 15 }
        })
      } catch (error: any) {
        console.error('Failed to fetch moderation activity:', error)
        this.activityError = error?.data?.statusMessage || error?.statusMessage || 'Failed to load activity'
      } finally {
        this.isLoadingActivity = false
      }
    },

    async updateSettings(partial: Partial<ModerationSettings>) {
      try {
        const data = await $fetch<{ success: boolean; settings: ModerationSettings }>('/api/moderation', {
          method: 'PUT',
          body: partial
        })
        if (data.success) {
          this.settings = { ...data.settings, blockedKeywords: data.settings.blockedKeywords || [] }
        }
        return data
      } catch (error) {
        console.error('Failed to update moderation settings:', error)
        throw error
      }
    }
  }
})
