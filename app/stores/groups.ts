import { defineStore } from 'pinia'

export interface TelegramGroup {
  id: string
  chatId: string
  name: string
  isActive: boolean
  type: 'group' | 'channel' | 'supergroup' | 'private'
  isAdmin: boolean
  permissionsVerified: boolean
  createdAt: string
  lastMessageTime: string | null
}

export const useGroupsStore = defineStore('groups', {
  state: () => ({
    groups: [] as TelegramGroup[],
    isLoading: false
  }),

  actions: {
    async fetchGroups() {
      this.isLoading = true
      try {
        const data = await $fetch<TelegramGroup[]>('/api/groups')
        this.groups = data
      } catch (error) {
        console.error('Failed to fetch groups:', error)
      } finally {
        this.isLoading = false
      }
    },

    async addGroup(chatId: string, name: string, type: 'group' | 'channel' | 'supergroup' | 'private' = 'group') {
      this.isLoading = true
      try {
        const data = await $fetch<{ success: boolean; group: TelegramGroup }>('/api/groups', {
          method: 'POST',
          body: { chatId, name, type }
        })
        if (data.success) {
          await this.fetchGroups()
        }
        return data
      } finally {
        this.isLoading = false
      }
    },

    async toggleGroupStatus(id: string, isActive: boolean) {
      try {
        const data = await $fetch<{ success: boolean; group: TelegramGroup }>(`/api/groups/${id}`, {
          method: 'PUT',
          body: { isActive }
        })
        if (data.success) {
          const index = this.groups.findIndex(g => g.id === id)
          if (index !== -1) {
            this.groups[index].isActive = data.group.isActive
          }
        }
        return data
      } catch (error) {
        console.error('Failed to toggle group status:', error)
        throw error
      }
    },

    async updateGroup(id: string, chatId: string, name: string, type?: 'group' | 'channel' | 'supergroup' | 'private') {
      this.isLoading = true
      try {
        const data = await $fetch<{ success: boolean; group: TelegramGroup }>(`/api/groups/${id}`, {
          method: 'PUT',
          body: { chatId, name, type }
        })
        if (data.success) {
          await this.fetchGroups()
        }
        return data
      } finally {
        this.isLoading = false
      }
    },

    async deleteGroup(id: string) {
      this.isLoading = true
      try {
        const data = await $fetch<{ success: boolean }>(`/api/groups/${id}`, {
          method: 'DELETE'
        })
        if (data.success) {
          this.groups = this.groups.filter(g => g.id !== id)
        }
        return data
      } finally {
        this.isLoading = false
      }
    }
  }
})
