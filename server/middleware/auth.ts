import { getSessionUser } from '../utils/session'

export default defineEventHandler(async (event) => {
  const path = event.path

  // Telegram itself posts updates here, so only this exact route is public
  // (it is authenticated by the webhook secret instead). Webhook status,
  // setup and sync are admin actions and require a session.
  const pathname = path.split('?')[0]
  const isTelegramWebhook = pathname === '/api/telegram/webhook' && event.method === 'POST'

  // Only protect API routes, except for /api/auth/, /api/health, /api/media/, and the Telegram webhook
  if (
    path.startsWith('/api/') &&
    !path.startsWith('/api/auth/') &&
    !isTelegramWebhook &&
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
