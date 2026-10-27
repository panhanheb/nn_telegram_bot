export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()

  // Initialize session state on route changes
  if (!authStore.isInitialized) {
    await authStore.fetchUser()
  }

  const isPublicPage = ['/login'].includes(to.path)

  // If setup is required and user is not on /login, redirect to /login
  if (authStore.setupRequired && !isPublicPage) {
    return navigateTo('/login')
  }

  // Redirect to login if not authenticated
  if (!authStore.isAuthenticated && !isPublicPage) {
    return navigateTo('/login')
  }

  // Redirect to dashboard if already authenticated and trying to access login
  if (authStore.isAuthenticated && isPublicPage) {
    return navigateTo('/')
  }
})
