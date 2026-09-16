import { getSessionUser } from '../utils/session'

export default defineEventHandler(async (event) => {
  const path = event.path

  // Only protect API routes, except for /api/auth/, /api/health, /api/media/, and webhook endpoints
  if (
    path.startsWith('/api/') &&
    !path.startsWith('/api/auth/') &&
    !path.startsWith('/api/telegram') &&
    !path.startsWith('/api/health') &&
    !path.startsWith('/api/media/')
  ) {
    const user = await getSessionUser(event)
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      })
    }
    // Attach user to event context
    event.context.user = user
  }
})
