import { H3Event } from 'h3'
import { encryptToken, decryptToken } from './crypto'

export interface SessionData {
  userId: string
  username: string
  expiresAt: number
}

const SESSION_COOKIE_NAME = 'teleflow_session'
const ONE_DAY_IN_SECONDS = 24 * 60 * 60

/**
 * Encrypts user details and sets the session cookie.
 */
export async function createSession(event: H3Event, user: { id: string; username: string }) {
  const session: SessionData = {
    userId: user.id,
    username: user.username,
    expiresAt: Date.now() + ONE_DAY_IN_SECONDS * 1000
  }

  const encrypted = await encryptToken(JSON.stringify(session))

  let isSecure = process.env.NODE_ENV === 'production'
  try {
    const proto = getRequestHeader(event, 'x-forwarded-proto')
    const host = getRequestHeader(event, 'host') || ''
    if (proto === 'http' || host.includes('localhost') || host.includes('127.0.0.1')) {
      isSecure = false
    } else if (proto === 'https') {
      isSecure = true
    }
  } catch {}

  setCookie(event, SESSION_COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_DAY_IN_SECONDS
  })
}

/**
 * Decrypts and verifies the session cookie, returning user information if valid.
 */
export async function getSessionUser(event: H3Event): Promise<{ id: string; username: string } | null> {
  const cookie = getCookie(event, SESSION_COOKIE_NAME)
  if (!cookie) {
    return null
  }

  try {
    const decrypted = await decryptToken(cookie)
    const session = JSON.parse(decrypted) as SessionData

    if (Date.now() > session.expiresAt) {
      // Session has expired, clean up the cookie
      deleteCookie(event, SESSION_COOKIE_NAME, { path: '/' })
      return null
    }

    return {
      id: session.userId,
      username: session.username
    }
  } catch (error) {
    // If decryption fails or JSON parsing fails, cookie is invalid/tampered
    deleteCookie(event, SESSION_COOKIE_NAME, { path: '/' })
    return null
  }
}

/**
 * Clears the session cookie.
 */
export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE_NAME, { path: '/' })
}
