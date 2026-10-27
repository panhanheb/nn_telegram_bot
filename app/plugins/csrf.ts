export default defineNuxtPlugin(() => {
  const getCsrfToken = (): string | null => {
    // Read from cookie first if in browser
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|;\s*)teleflow_csrf=([^;]*)/)
      if (match && match[1]) {
        return decodeURIComponent(match[1])
      }
    }
    // Fall back to Pinia auth store
    try {
      const authStore = useAuthStore()
      if (authStore?.csrfToken) {
        return authStore.csrfToken
      }
    } catch {}
    return null
  }

  // Hook into Nuxt $fetch
  const originalFetch = globalThis.$fetch
  if (originalFetch && typeof (originalFetch as any).create === 'function') {
    globalThis.$fetch = (originalFetch as any).create({
      onRequest({ options }: { options: any }) {
        const method = (options.method || 'GET').toUpperCase()
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          const token = getCsrfToken()
          if (token) {
            const headers = new Headers(options.headers)
            headers.set('x-csrf-token', token)
            options.headers = headers
          }
        }
      }
    })
  }
})
