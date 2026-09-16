import { defineStore } from 'pinia'

export interface MessageLog {
  id: string
  groupId: string | null
  group: {
    name: string
    chatId: string
  }
  scheduleId: string | null
  schedule: {
    title: string
  } | null
  message: string
  status: 'SUCCESS' | 'FAILED'
  error: string | null
  sentAt: string
}

export interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

export const useLogsStore = defineStore('logs', {
  state: () => ({
    logs: [] as MessageLog[],
    pagination: {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 1
    } as Pagination,
    search: '',
    status: '',
    groupId: '',
    isLoading: false
  }),

  actions: {
    async fetchLogs(page = 1) {
      this.isLoading = true
      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: String(this.pagination.limit),
          search: this.search,
          status: this.status,
          groupId: this.groupId
        })

        const data = await $fetch<{ logs: MessageLog[]; pagination: Pagination }>(
          `/api/logs?${queryParams.toString()}`
        )
        this.logs = data.logs
        this.pagination = data.pagination
      } catch (error) {
        console.error('Failed to fetch message logs:', error)
      } finally {
        this.isLoading = false
      }
    },

    setSearch(search: string) {
      this.search = search
      this.fetchLogs(1)
    },

    setStatus(status: string) {
      this.status = status
      this.fetchLogs(1)
    },

    setGroupId(groupId: string) {
      this.groupId = groupId
      this.fetchLogs(1)
    },

    resetFilters() {
      this.search = ''
      this.status = ''
      this.groupId = ''
      this.fetchLogs(1)
    }
  }
})
