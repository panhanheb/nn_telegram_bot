/**
 * In-memory / storage-backed rate limiter with sliding window & lockout.
 * Protects login endpoints against brute force and credential stuffing.
 */

interface RateLimitRecord {
  attempts: number
  firstAttemptAt: number
  lockedUntil: number
}

// Memory cache for active rate limit windows
const limitStore = new Map<string, RateLimitRecord>()

// Cleanup stale records periodically to avoid memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000
let cleanupTimer: any = null

function ensureCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, record] of limitStore.entries()) {
      if (now > record.lockedUntil && now - record.firstAttemptAt > 60 * 60 * 1000) {
        limitStore.delete(key)
      }
    }
  }, CLEANUP_INTERVAL_MS)
  if (typeof cleanupTimer?.unref === 'function') {
    cleanupTimer.unref()
  }
}

export interface RateLimitOptions {
  maxAttempts: number
  windowMs: number
  lockoutMs: number
}

const DEFAULT_LOGIN_LIMITS: RateLimitOptions = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,   // 15 minutes
  lockoutMs: 15 * 60 * 1000   // 15 minutes lockout
}

/**
 * Check if the given identifier is currently locked out or rate-limited.
 */
export function checkRateLimit(key: string, options: Partial<RateLimitOptions> = {}): {
  allowed: boolean
  remainingAttempts: number
  retryAfterSeconds: number
} {
  ensureCleanup()
  const opts = { ...DEFAULT_LOGIN_LIMITS, ...options }
  const now = Date.now()
  const record = limitStore.get(key)

  if (!record) {
    return {
      allowed: true,
      remainingAttempts: opts.maxAttempts,
      retryAfterSeconds: 0
    }
  }

  // Check if currently locked
  if (record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000)
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds
    }
  }

  // Check if window has expired
  if (now - record.firstAttemptAt > opts.windowMs) {
    limitStore.delete(key)
    return {
      allowed: true,
      remainingAttempts: opts.maxAttempts,
      retryAfterSeconds: 0
    }
  }

  const remaining = Math.max(0, opts.maxAttempts - record.attempts)
  return {
    allowed: remaining > 0,
    remainingAttempts: remaining,
    retryAfterSeconds: remaining === 0 ? Math.ceil((record.lockedUntil - now) / 1000) : 0
  }
}

/**
 * Record a failed attempt for the identifier.
 */
export function recordFailedAttempt(key: string, options: Partial<RateLimitOptions> = {}): {
  locked: boolean
  remainingAttempts: number
  retryAfterSeconds: number
} {
  ensureCleanup()
  const opts = { ...DEFAULT_LOGIN_LIMITS, ...options }
  const now = Date.now()
  let record = limitStore.get(key)

  if (!record || now - record.firstAttemptAt > opts.windowMs) {
    record = {
      attempts: 1,
      firstAttemptAt: now,
      lockedUntil: 0
    }
  } else {
    record.attempts += 1
  }

  if (record.attempts >= opts.maxAttempts) {
    record.lockedUntil = now + opts.lockoutMs
    limitStore.set(key, record)
    return {
      locked: true,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil(opts.lockoutMs / 1000)
    }
  }

  limitStore.set(key, record)
  return {
    locked: false,
    remainingAttempts: opts.maxAttempts - record.attempts,
    retryAfterSeconds: 0
  }
}

/**
 * Reset failed attempts upon successful authentication.
 */
export function resetRateLimit(key: string): void {
  limitStore.delete(key)
}

/**
 * Clear all rate limits (useful for testing).
 */
export function clearAllRateLimits(): void {
  limitStore.clear()
}
