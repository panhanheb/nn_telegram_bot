import { z } from 'zod'
import { db } from '../../utils/db'
import { verifyPassword, hashPassword } from '../../utils/crypto'
import { createSession } from '../../utils/session'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '../../utils/rate-limiter'
import { logAudit } from '../../utils/audit'

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
})

export default defineEventHandler(async (event) => {
  const ipAddress = getRequestHeader(event, 'cf-connecting-ip') ||
    getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
    event.node?.req?.socket?.remoteAddress ||
    '127.0.0.1'

  const rawBody = await readBody(event).catch(() => null)
  const parseResult = loginSchema.safeParse(rawBody)

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.issues[0]?.message || 'Invalid username or password'
    })
  }

  const { username, password } = parseResult.data
  const rateLimitKey = `login:${ipAddress}:${username.toLowerCase()}`

  // Check rate limit status
  const limitCheck = checkRateLimit(rateLimitKey)
  if (!limitCheck.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: `Too many failed login attempts. Please wait ${limitCheck.retryAfterSeconds} seconds before trying again.`
    })
  }

  // Retrieve user by username
  const user = await db.getUserByUsername(username)
  if (!user) {
    recordFailedAttempt(rateLimitKey)
    await logAudit(event, 'LOGIN_FAILED', 'User', undefined, { username, reason: 'user_not_found', ip: ipAddress })
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid username or password'
    })
  }

  // Verify password using PBKDF2 with transparent upgrade
  const { valid, needsRehash } = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    const attempt = recordFailedAttempt(rateLimitKey)
    await logAudit(event, 'LOGIN_FAILED', 'User', user.id, { username, reason: 'invalid_password', ip: ipAddress })

    if (attempt.locked) {
      throw createError({
        statusCode: 429,
        statusMessage: `Too many failed attempts. Account locked for ${attempt.retryAfterSeconds} seconds.`
      })
    }

    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid username or password'
    })
  }

  // Reset rate limiter on successful authentication
  resetRateLimit(rateLimitKey)

  // Transparently upgrade legacy SHA-256 hash to PBKDF2-SHA256
  if (needsRehash) {
    try {
      const upgradedHash = await hashPassword(password)
      await db.updateUserPassword(user.id, upgradedHash)
    } catch (rehashErr) {
      console.warn('[auth] Could not auto-rehash password:', rehashErr)
    }
  }

  // Create session and set cookies
  const { csrfToken } = await createSession(event, user)

  // Record audit log
  event.context.user = { id: user.id, username: user.username, role: user.role }
  await logAudit(event, 'LOGIN_SUCCESS', 'User', user.id, { username: user.username, ip: ipAddress })

  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    },
    csrfToken
  }
})
