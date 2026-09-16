import { defineStore } from 'pinia'

export interface NextScheduleInfo {
  id: string
  title: string
  time: string
  message: string
  execTime: string
  minutesLeft: number
}

export interface DashboardStats {
  botConfigured: boolean
  botOnline: boolean
  botUsername: string | null
  totalGroups: number
  totalChannels: number
  overallGroupsCount: number
  activeSchedules: number
  totalSchedules: number
  messagesSent: number
  failedDeliveries: number
  successRate: number
  totalLogs: number
  sentToday: number
  failedToday: number
  nextSchedule: NextScheduleInfo | null
}

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    stats: {
      botConfigured: false,
      botOnline: false,
      botUsername: null,
      totalGroups: 0,
      totalChannels: 0,
      overallGroupsCount: 0,
      activeSchedules: 0,
      totalSchedules: 0,
      messagesSent: 0,
      failedDeliveries: 0,
      successRate: 100,
      totalLogs: 0,
      sentToday: 0,
      failedToday: 0,
      nextSchedule: null
    } as DashboardStats,
    isLoading: false
  }),

  actions: {
    async fetchStats() {
      this.isLoading = true
      try {
        const data = await $fetch<DashboardStats>('/api/dashboard/stats')
        this.stats = data
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
      } finally {
        this.isLoading = false
      }
    }
  }
})
