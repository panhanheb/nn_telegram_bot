import { getSessionUser, validateCsrfToken } from '../utils/session'
import { db } from '../utils/db'

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  const method = event.method
  const pathname = path.split('?')[0] || ''

  // Telegram webhook is public to Telegram servers (authenticated by secret token header)
  const isTelegramWebhook = pathname === '/api/telegram/webhook' && method === 'POST'
  const isSetupStatus = pathname === '/api/auth/setup-status'
  const isSetupAction = pathname === '/api/auth/setup' && method === 'POST'
  const isLoginAction = pathname === '/api/auth/login' && method === 'POST'
  const isHealthCheck = pathname === '/api/health'

  // Non-API paths (Nuxt pages, assets, Vite HMR) pass through
  if (!pathname.startsWith('/api/')) {
    return
  }

  // 1. Initial Setup Gate
  // If no Owner account exists yet, block all API routes except setup status and setup post
  const setupRequired = await db.isSetupRequired()
  if (setupRequired) {
    if (isSetupStatus || isSetupAction || isHealthCheck) {
      return
    }
    throw createError({
      statusCode: 503,
      statusMessage: 'Initial setup required. Please configure the primary Owner account.',
      data: { setupRequired: true }
    })
  }

  // 2. Allow public endpoints when setup is already completed
  if (isTelegramWebhook || isLoginAction || isSetupStatus || isHealthCheck) {
    return
  }

  // 3. Authenticate Session for all other /api/ routes
  const sessionUser = await getSessionUser(event)
  if (!sessionUser) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Session missing, invalid, or expired'
    })
  }

  // Attach user and session to H3 event context
  event.context.user = {
    id: sessionUser.id,
    username: sessionUser.username,
    role: sessionUser.role
  }
  event.context.session = sessionUser.session

  // 4. CSRF Protection for state-mutating requests
  // Safe methods: GET, HEAD, OPTIONS
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  if (isMutating) {
    // If request used Bearer token authorization header, CSRF is not strictly required
    // because browsers do not auto-attach custom headers cross-origin.
    const authHeader = getRequestHeader(event, 'authorization')
    const isBearer = Boolean(authHeader && authHeader.startsWith('Bearer '))

    if (!isBearer) {
      const isValidCsrf = validateCsrfToken(event, sessionUser.session)
      if (!isValidCsrf) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Forbidden: Invalid or missing CSRF token'
        })
      }
    }
  }
})
