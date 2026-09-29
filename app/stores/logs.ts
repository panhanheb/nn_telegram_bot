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

export interface LogFilters {
  search: string
  status: string
  groupId: string
}

// Guards against out-of-order responses when filters change quickly
// (e.g. typing in the search box): only the latest request may commit.
let requestSeq = 0

export const useLogsStore = defineStore('logs', {
  state: () => ({
    logs: [] as MessageLog[],
    pagination: {
      total: 0,
      page: 1,
      limit: 25,
      totalPages: 1
    } as Pagination,
    search: '',
    status: '',
    groupId: '',
    isLoading: false,
    loaded: false,
    error: null as string | null
  }),

  getters: {
    hasFilters: (state) => Boolean(state.search || state.status || state.groupId)
  },

  actions: {
    queryFor(page: number, limit: number) {
      const query: Record<string, string> = { page: String(page), limit: String(limit) }
      if (this.search) query.search = this.search
      if (this.status) query.status = this.status
      if (this.groupId) query.groupId = this.groupId
      return query
    },

    async fetchLogs(page?: number): Promise<void> {
      if (page === undefined) page = this.pagination.page || 1
      const seq = ++requestSeq
      this.isLoading = true
      try {
        const data = await $fetch<{ logs: MessageLog[]; pagination: Pagination }>('/api/logs', {
          query: this.queryFor(Math.max(1, page), this.pagination.limit)
        })
        if (seq !== requestSeq) return
        // Clamp when the current page no longer exists (e.g. logs were pruned)
        const totalPages = Math.max(1, data.pagination.totalPages)
        if (data.pagination.total > 0 && page > totalPages) {
          await this.fetchLogs(totalPages)
          return
        }
        this.logs = data.logs
        this.pagination = { ...data.pagination, totalPages }
        this.error = null
        this.loaded = true
      } catch (error: any) {
        if (seq !== requestSeq) return
        console.error('Failed to fetch message logs:', error)
        this.error = error?.data?.statusMessage || error?.statusMessage || error?.message || 'Failed to load logs'
      } finally {
        if (seq === requestSeq) this.isLoading = false
      }
    },

    /** Fetch every log matching the current filters (used for export). */
    async fetchAllMatching(): Promise<MessageLog[]> {
      const limit = Math.max(1, this.pagination.total)
      const data = await $fetch<{ logs: MessageLog[] }>('/api/logs', { query: this.queryFor(1, limit) })
      return data.logs
    },

    setPage(page: number) {
      const target = Math.min(Math.max(1, page), Math.max(1, this.pagination.totalPages))
      return this.fetchLogs(target)
    },

    setLimit(limit: number) {
      this.pagination.limit = limit
      return this.fetchLogs(1)
    },

    setSearch(search: string) {
      this.search = search.trim()
      return this.fetchLogs(1)
    },

    setStatus(status: string) {
      this.status = status
      return this.fetchLogs(1)
    },

    setGroupId(groupId: string) {
      this.groupId = groupId
      return this.fetchLogs(1)
    },

    resetFilters() {
      this.search = ''
      this.status = ''
      this.groupId = ''
      return this.fetchLogs(1)
    }
  }
})
