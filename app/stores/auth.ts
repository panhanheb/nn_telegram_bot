import { defineStore } from 'pinia'

export type UserRole = 'Owner' | 'Admin' | 'Moderator' | 'Viewer'

export interface UserInfo {
  id: string
  username: string
  role: UserRole
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as UserInfo | null,
    csrfToken: null as string | null,
    setupRequired: false,
    isLoading: false,
    isInitialized: false
  }),

  getters: {
    isAuthenticated: (state) => state.user !== null,
    isOwner: (state) => state.user?.role === 'Owner',
    isAdminOrOwner: (state) => state.user?.role === 'Owner' || state.user?.role === 'Admin',
    canModerate: (state) => ['Owner', 'Admin', 'Moderator'].includes(state.user?.role || '')
  },

  actions: {
    async checkSetupStatus(): Promise<boolean> {
      try {
        const data = await $fetch<{ setupRequired: boolean }>('/api/auth/setup-status')
        this.setupRequired = Boolean(data.setupRequired)
        return this.setupRequired
      } catch {
        return false
      }
    },

    async fetchUser() {
      this.isLoading = true
      try {
        const setupNeeded = await this.checkSetupStatus()
        if (setupNeeded) {
          this.user = null
          return
        }

        const data = await $fetch<{ user: UserInfo | null; csrfToken?: string | null }>('/api/auth/me')
        this.user = data.user
        if (data.csrfToken) {
          this.csrfToken = data.csrfToken
        }
      } catch (error: any) {
        if (error.data?.data?.setupRequired || error.statusCode === 503) {
          this.setupRequired = true
        }
        this.user = null
      } finally {
        this.isInitialized = true
        this.isLoading = false
      }
    },

    async setupOwner(username: string, password: string) {
      this.isLoading = true
      try {
        const data = await $fetch<{ success: boolean; user: UserInfo; csrfToken?: string }>('/api/auth/setup', {
          method: 'POST',
          body: { username, password }
        })
        if (data.success) {
          this.user = data.user
          this.setupRequired = false
          this.isInitialized = true
          if (data.csrfToken) {
            this.csrfToken = data.csrfToken
          }
        }
        return data
      } finally {
        this.isLoading = false
      }
    },

    async login(username: string, password: string) {
      this.isLoading = true
      try {
        const data = await $fetch<{ success: boolean; user: UserInfo; csrfToken?: string }>('/api/auth/login', {
          method: 'POST',
          body: { username, password }
        })
        if (data.success) {
          this.user = data.user
          this.isInitialized = true
          if (data.csrfToken) {
            this.csrfToken = data.csrfToken
          }
        }
        return data
      } finally {
        this.isLoading = false
      }
    },

    async logout() {
      this.isLoading = true
      try {
        const headers: Record<string, string> = {}
        if (this.csrfToken) {
          headers['x-csrf-token'] = this.csrfToken
        }
        await $fetch('/api/auth/logout', {
          method: 'POST',
          headers
        })
      } catch (error) {
        console.warn('Logout notification error:', error)
      } finally {
        this.user = null
        this.csrfToken = null
        this.isLoading = false
        await navigateTo('/login')
      }
    }
  }
})
