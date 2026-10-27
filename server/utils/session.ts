import { H3Event, getRequestHeader, getCookie, setCookie, deleteCookie, createError } from 'h3'
import { db } from './db'
import type { UserRole, JSONSession } from './db'
import { timingSafeEqual } from './crypto'

export const SESSION_COOKIE_NAME = 'teleflow_session'
export const CSRF_COOKIE_NAME = 'teleflow_csrf'
export const CSRF_HEADER_NAME = 'x-csrf-token'

// Sessions last up to 7 days, with 24 hours idle expiration
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60
export const SESSION_IDLE_TIMEOUT_SECONDS = 24 * 60 * 60

/**
 * Generate cryptographically secure random hex string (32 bytes = 64 hex chars).
 */
export function generateSecureToken(bytes = 32): string {
  const array = new Uint8Array(bytes)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array)
  } else {
    // Fallback if global crypto not initialized
    const nodeCrypto = require('node:crypto')
    return nodeCrypto.randomBytes(bytes).toString('hex')
  }
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

function determineIsSecure(event: H3Event): boolean {
  if (process.env.NODE_ENV !== 'production') return false
  try {
    const proto = getRequestHeader(event, 'x-forwarded-proto')
    const host = getRequestHeader(event, 'host') || ''
    if (proto === 'http' || host.includes('localhost') || host.includes('127.0.0.1')) {
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Issues a server-side session and sets the session cookie + CSRF token.
 */
export async function createSession(
  event: H3Event,
  user: { id: string; username: string; role: UserRole }
): Promise<{ session: JSONSession; csrfToken: string }> {
  const sessionId = generateSecureToken(32)
  const csrfToken = generateSecureToken(32)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000)

  let ipAddress = getRequestHeader(event, 'cf-connecting-ip') ||
    getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
    event.node?.req?.socket?.remoteAddress ||
    '127.0.0.1'

  const userAgent = getRequestHeader(event, 'user-agent') || 'Unknown'

  const session: JSONSession = {
    id: sessionId,
    userId: user.id,
    username: user.username,
    role: user.role,
    csrfToken,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastActiveAt: now.toISOString(),
    ipAddress,
    userAgent
  }

  await db.saveSession(session)

  const isSecure = determineIsSecure(event)

  // HttpOnly session cookie
  setCookie(event, SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS
  })

  // Non-HttpOnly CSRF token cookie readable by client application
  setCookie(event, CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS
  })

  return { session, csrfToken }
}

/**
 * Validates the session cookie or Authorization header, touches the session,
 * and returns the authenticated user and session data.
 */
export async function getSessionUser(
  event: H3Event
): Promise<{ id: string; username: string; role: UserRole; session: JSONSession } | null> {
  let sessionId = getCookie(event, SESSION_COOKIE_NAME)

  if (!sessionId) {
    const authHeader = getRequestHeader(event, 'authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionId = authHeader.substring(7).trim()
    }
  }

  if (!sessionId) {
    return null
  }

  const session = await db.getSession(sessionId)
  if (!session) {
    // Session is invalid or expired
    deleteCookie(event, SESSION_COOKIE_NAME, { path: '/' })
    deleteCookie(event, CSRF_COOKIE_NAME, { path: '/' })
    return null
  }

  // Touch session activity timestamp
  await db.touchSession(sessionId)

  const user = await db.getUserById(session.userId)
  if (!user) {
    // User was deleted
    await db.deleteSession(sessionId)
    deleteCookie(event, SESSION_COOKIE_NAME, { path: '/' })
    deleteCookie(event, CSRF_COOKIE_NAME, { path: '/' })
    return null
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    session
  }
}

/**
 * Validates CSRF token from request header against the active session.
 */
export function validateCsrfToken(event: H3Event, session: JSONSession): boolean {
  const csrfHeader = getRequestHeader(event, CSRF_HEADER_NAME) || getRequestHeader(event, 'x-xsrf-token')
  if (!csrfHeader || !session.csrfToken) {
    return false
  }
  return timingSafeEqual(csrfHeader, session.csrfToken)
}

/**
 * Destroys current session and removes session cookies.
 */
export async function destroySession(event: H3Event): Promise<void> {
  const sessionId = getCookie(event, SESSION_COOKIE_NAME)
  if (sessionId) {
    await db.deleteSession(sessionId)
  }
  deleteCookie(event, SESSION_COOKIE_NAME, { path: '/' })
  deleteCookie(event, CSRF_COOKIE_NAME, { path: '/' })
}

/**
 * Clear session cookie without async (backward compatibility).
 */
export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE_NAME, { path: '/' })
  deleteCookie(event, CSRF_COOKIE_NAME, { path: '/' })
}

/**
 * Helper to enforce RBAC permissions in route handlers.
 */
export function requireRole(event: H3Event, ...allowedRoles: UserRole[]): void {
  const user = event.context.user
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Authentication required'
    })
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Forbidden: Role '${user.role}' lacks permission for this action`
    })
  }
}
