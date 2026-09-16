import { defineStore } from 'pinia'

export interface Schedule {
  id: string
  title: string
  type: 'one_time' | 'daily' | 'weekly' | 'monthly' | 'cron'
  time: string // HH:MM or Cron
  dayOfWeek?: number
  dayOfMonth?: number
  timezone: string
  message: string
  messageType: 'text' | 'photo' | 'video' | 'document'
  mediaUrl?: string
  parseMode: 'HTML' | 'MarkdownV2'
  targetGroupIds?: number[]
  isActive: boolean
  createdAt: string
  lastExecutedAt?: string
}

export const useSchedulesStore = defineStore('schedules', {
  state: () => ({
    schedules: [] as Schedule[],
    isLoading: false
  }),

  actions: {
    async fetchSchedules() {
      this.isLoading = true
      try {
        const data = await $fetch<Schedule[]>('/api/schedules')
        this.schedules = data
      } catch (error) {
        console.error('Failed to fetch schedules:', error)
      } finally {
        this.isLoading = false
      }
    },

    async addSchedule(payload: Omit<Schedule, 'id' | 'createdAt' | 'isActive'> & { isActive?: boolean }) {
      this.isLoading = true
      try {
        const data = await $fetch<{ success: boolean; schedule: Schedule }>('/api/schedules', {
          method: 'POST',
          body: payload
        })
        if (data.success) {
          await this.fetchSchedules()
        }
        return data
      } finally {
        this.isLoading = false
      }
    },

    async toggleScheduleStatus(id: string, isActive: boolean) {
      try {
        const data = await $fetch<{ success: boolean; schedule: Schedule }>(`/api/schedules/${id}`, {
          method: 'PUT',
          body: { isActive }
        })
        if (data.success) {
          const index = this.schedules.findIndex(s => s.id === id)
          if (index !== -1) {
            this.schedules[index].isActive = data.schedule.isActive
          }
        }
        return data
      } catch (error) {
        console.error('Failed to toggle schedule status:', error)
        throw error
      }
    },

    async updateSchedule(id: string, payload: Partial<Omit<Schedule, 'id' | 'createdAt'>>) {
      this.isLoading = true
      try {
        const data = await $fetch<{ success: boolean; schedule: Schedule }>(`/api/schedules/${id}`, {
          method: 'PUT',
          body: payload
        })
        if (data.success) {
          await this.fetchSchedules()
        }
        return data
      } finally {
        this.isLoading = false
      }
    },

    async deleteSchedule(id: string) {
      this.isLoading = true
      try {
        const data = await $fetch<{ success: boolean }>(`/api/schedules/${id}`, {
          method: 'DELETE'
        })
        if (data.success) {
          this.schedules = this.schedules.filter(s => s.id !== id)
        }
        return data
      } finally {
        this.isLoading = false
      }
    }
  }
})
