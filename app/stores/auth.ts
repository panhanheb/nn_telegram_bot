import { defineStore } from 'pinia'

export interface UserInfo {
  id: string
  username: string
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as UserInfo | null,
    isLoading: false,
    isInitialized: false
  }),

  getters: {
    isAuthenticated: (state) => state.user !== null
  },

  actions: {
    async fetchUser() {
      // Force fetching if not initialized
      this.isLoading = true
      try {
        const data = await $fetch<{ user: UserInfo | null }>('/api/auth/me')
        this.user = data.user
      } catch (error) {
        console.error('Failed to fetch auth session:', error)
        this.user = null
      } finally {
        this.isInitialized = true
        this.isLoading = false
      }
    },

    async login(username: string, password: string) {
      this.isLoading = true
      try {
        const data = await $fetch<{ success: boolean; user: UserInfo }>('/api/auth/login', {
          method: 'POST',
          body: { username, password }
        })
        if (data.success) {
          this.user = data.user
          this.isInitialized = true
        }
        return data
      } finally {
        this.isLoading = false
      }
    },

    async register(username: string, password: string) {
      this.isLoading = true
      try {
        const data = await $fetch<{ success: boolean; user: UserInfo }>('/api/auth/register', {
          method: 'POST',
          body: { username, password }
        })
        if (data.success) {
          this.user = data.user
        }
        return data
      } finally {
        this.isLoading = false
      }
    },

    async logout() {
      this.isLoading = true
      try {
        await $fetch('/api/auth/logout', {
          method: 'POST'
        })
        this.user = null
        navigateTo('/login')
      } catch (error) {
        console.error('Failed to logout:', error)
      } finally {
        this.isLoading = false
      }
    }
  }
})
